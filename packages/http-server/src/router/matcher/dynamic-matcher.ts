import type { RouteKey } from '../../types';
import type { HttpMethod } from '../enums';
import type { ImmutableRouterLayout, SerializedNodeRecord } from '../layout/immutable-router-layout';
import { ROUTE_REGEX_TIMEOUT } from '../pattern/pattern-tester';
import { matchStaticParts } from '../tree/tree-utils';
import type {
  DynamicMatchResult,
  DynamicMatcherConfig,
  EncodedSlashBehavior,
  MatchObserverHooks,
  PatternTesterFn,
  RouteParams,
} from '../types';
import { decodeURIComponentSafe } from '../utils/path-utils';

import { FrameStage, type MatchFrame } from './match-frame';
import { WildcardSuffixCache } from './suffix-cache';

/**
 * DynamicMatcher walks the immutable router layout using a manual stack-based state machine.
 * Each frame progresses through the following stages:
 *
 * Enter -> Static -> Params -> Wildcard -> Exit
 *
 * Splitting the logic into dedicated handlers keeps the main `walk()` loop readable while
 * preserving the imperative structure required for performance-sensitive routing hot paths.
 */
export class DynamicMatcher {
  private readonly method: HttpMethod;
  private readonly segments: string[];
  private readonly decodeParams: boolean;
  private readonly hasWildcardRoutes: boolean;
  private readonly captureSnapshot: boolean;
  private readonly layout: ImmutableRouterLayout;
  private readonly nodes: ImmutableRouterLayout['nodes'];
  private readonly staticChildren: ImmutableRouterLayout['staticChildren'];
  private readonly paramChildren: ImmutableRouterLayout['paramChildren'];
  private readonly methods: ImmutableRouterLayout['methods'];
  private readonly segmentChains: ImmutableRouterLayout['segmentChains'];
  private readonly patternTesters: ReadonlyArray<PatternTesterFn | undefined>;
  private readonly paramOrders?: ReadonlyArray<Uint16Array | null>;
  private readonly observer?: MatchObserverHooks;
  private readonly encodedSlashBehavior: EncodedSlashBehavior;

  private paramNames: string[] = [];
  private paramValues: string[] = [];
  private paramCount = 0;
  private decodedSegmentCache?: Array<string | undefined>;
  private suffixHelper?: WildcardSuffixCache;

  constructor(config: DynamicMatcherConfig) {
    this.method = config.method;
    this.segments = config.segments;
    this.decodeParams = config.decodeParams;
    this.hasWildcardRoutes = config.hasWildcardRoutes;
    this.captureSnapshot = config.captureSnapshot;
    this.layout = config.layout;
    this.nodes = this.layout.nodes;
    this.staticChildren = this.layout.staticChildren;
    this.paramChildren = this.layout.paramChildren;
    this.methods = this.layout.methods;
    this.segmentChains = this.layout.segmentChains;
    this.patternTesters = config.patternTesters;
    this.paramOrders = config.paramOrders;
    this.observer = config.observer;
    this.encodedSlashBehavior = config.encodedSlashBehavior;
    if (this.hasWildcardRoutes) {
      this.suffixHelper = new WildcardSuffixCache({
        segments: this.segments,
        decodeParams: this.decodeParams,
        encodedSlashBehavior: this.encodedSlashBehavior,
        plan: config.suffixPlan,
      });
    }
  }

  match(): DynamicMatchResult | null {
    const key = this.walk();
    if (key === null) {
      return null;
    }
    if (!this.paramCount) {
      return { key, params: Object.create(null) as RouteParams };
    }
    const { params, snapshot } = this.buildParams();
    return { key, params, snapshot };
  }

  private walk(): RouteKey | null {
    const stack: MatchFrame[] = [
      { nodeIndex: this.layout.rootIndex, segmentIndex: 0, stage: FrameStage.Enter, paramBase: 0, paramCursor: 0 },
    ];

    while (stack.length) {
      const frame = stack[stack.length - 1]!;
      let result: RouteKey | undefined;
      switch (frame.stage) {
        case FrameStage.Enter:
          result = this.handleEnterStage(frame);
          break;
        case FrameStage.Static:
          result = this.handleStaticStage(frame, stack);
          break;
        case FrameStage.Params:
          result = this.handleParamStage(frame, stack);
          break;
        case FrameStage.Wildcard:
          result = this.handleWildcardStage(frame);
          break;
        case FrameStage.Exit:
          this.handleExitStage(stack);
          break;
        default:
          stack.pop();
          break;
      }
      if (result !== undefined) {
        return result;
      }
    }

    return null;
  }

  private handleEnterStage(frame: MatchFrame): RouteKey | undefined {
    if (frame.segmentIndex === this.segments.length) {
      const current = this.nodes[frame.nodeIndex]!;
      const found = this.lookupMethodKey(current);
      if (found !== null) {
        return found;
      }
      frame.stage = FrameStage.Wildcard;
      return undefined;
    }
    frame.stage = FrameStage.Static;
    return undefined;
  }

  private handleStaticStage(frame: MatchFrame, stack: MatchFrame[]): RouteKey | undefined {
    const node = this.nodes[frame.nodeIndex]!;
    if (frame.segmentIndex >= this.segments.length || node.staticRangeCount === 0) {
      frame.stage = FrameStage.Params;
      return undefined;
    }
    const childIndex = this.findStaticChild(node, this.segments[frame.segmentIndex]!);
    frame.stage = FrameStage.Params;
    if (childIndex === -1) {
      return undefined;
    }
    const child = this.nodes[childIndex]!;
    const chain = this.getSegmentParts(child);
    if (chain && chain.length > 1) {
      const matched = matchStaticParts(chain, this.segments, frame.segmentIndex);
      if (matched !== chain.length) {
        return undefined;
      }
      stack.push({
        nodeIndex: childIndex,
        segmentIndex: frame.segmentIndex + matched,
        stage: FrameStage.Enter,
        paramBase: this.paramCount,
        paramCursor: 0,
      });
      return undefined;
    }
    stack.push({
      nodeIndex: childIndex,
      segmentIndex: frame.segmentIndex + 1,
      stage: FrameStage.Enter,
      paramBase: this.paramCount,
      paramCursor: 0,
    });
    return undefined;
  }

  private handleParamStage(frame: MatchFrame, stack: MatchFrame[]): RouteKey | undefined {
    const node = this.nodes[frame.nodeIndex]!;
    if (frame.segmentIndex >= this.segments.length || node.paramRangeCount === 0) {
      frame.stage = FrameStage.Wildcard;
      frame.decodedSegment = undefined;
      return undefined;
    }
    if (frame.paramCursor >= node.paramRangeCount) {
      frame.stage = FrameStage.Wildcard;
      frame.decodedSegment = undefined;
      return undefined;
    }
    this.paramCount = frame.paramBase;
    frame.decodedSegment ??= this.getDecodedSegment(frame.segmentIndex);
    const decoded = frame.decodedSegment;
    const order = this.paramOrders ? this.paramOrders[frame.nodeIndex] : null;
    const orderedOffset = order ? order[frame.paramCursor] : frame.paramCursor;
    if (orderedOffset === undefined || orderedOffset >= node.paramRangeCount) {
      frame.stage = FrameStage.Wildcard;
      frame.decodedSegment = undefined;
      return undefined;
    }
    frame.paramCursor++;
    const edge = this.paramChildren[node.paramRangeStart + orderedOffset]!;
    const childIndex = edge.target;
    const child = this.nodes[childIndex]!;
    if (!this.testParamPattern(child.patternIndex, decoded)) {
      return undefined;
    }
    this.observer?.onParamBranch?.(frame.nodeIndex, orderedOffset);
    this.pushParam(child.segment, decoded);
    stack.push({
      nodeIndex: childIndex,
      segmentIndex: frame.segmentIndex + 1,
      stage: FrameStage.Enter,
      paramBase: this.paramCount,
      paramCursor: 0,
    });
    return undefined;
  }

  private handleWildcardStage(frame: MatchFrame): RouteKey | undefined {
    const node = this.nodes[frame.nodeIndex]!;
    frame.stage = FrameStage.Exit;
    const wildcardIndex = node.wildcardChild;
    if (wildcardIndex === -1) {
      return undefined;
    }
    this.paramCount = frame.paramBase;
    const wildcard = this.nodes[wildcardIndex]!;
    const key = this.lookupMethodKey(wildcard);
    if (key === null) {
      return undefined;
    }
    if (wildcard.wildcardOrigin === 'multi' && frame.segmentIndex >= this.segments.length) {
      return undefined;
    }
    const wildcardName = wildcard.segment || '*';
    const wildcardValue = this.suffixHelper?.getValue(frame.segmentIndex) ?? '';
    this.pushParam(wildcardName, wildcardValue);
    return key;
  }

  private handleExitStage(stack: MatchFrame[]): void {
    const frame = stack.pop();
    if (!frame) {
      return;
    }
    this.paramCount = frame.paramBase;
  }

  private lookupMethodKey(node: SerializedNodeRecord): RouteKey | null {
    if (!node.methodsRangeCount) {
      return null;
    }
    const start = node.methodsRangeStart;
    const end = start + node.methodsRangeCount;
    for (let i = start; i < end; i++) {
      const entry = this.methods[i]!;
      if (entry.method === this.method) {
        return entry.key;
      }
    }
    return null;
  }

  private findStaticChild(node: SerializedNodeRecord, segment: string): number {
    if (!node.staticRangeCount) {
      return -1;
    }
    let lo = node.staticRangeStart;
    let hi = lo + node.staticRangeCount - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const child = this.staticChildren[mid]!;
      if (child.segment === segment) {
        return child.target;
      }
      if (child.segment < segment) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return -1;
  }

  private getSegmentParts(node: SerializedNodeRecord): readonly string[] | null {
    if (node.segmentPartsIndex === -1) {
      return null;
    }
    return this.segmentChains[node.segmentPartsIndex] ?? null;
  }

  private testParamPattern(patternIndex: number, value: string): boolean {
    if (patternIndex === -1) {
      return true;
    }
    const tester = this.patternTesters[patternIndex];
    if (!tester) {
      return true;
    }
    try {
      return tester(value);
    } catch (error) {
      if (error && typeof error === 'object' && (error as Record<typeof ROUTE_REGEX_TIMEOUT, boolean>)[ROUTE_REGEX_TIMEOUT]) {
        throw error;
      }
      return false;
    }
  }

  private pushParam(name: string, value: string): void {
    this.paramNames[this.paramCount] = name;
    this.paramValues[this.paramCount] = value;
    this.paramCount++;
  }

  private getDecodedSegment(index: number): string {
    if (!this.decodeParams) {
      return this.segments[index]!;
    }
    this.decodedSegmentCache ??= new Array<string | undefined>(this.segments.length);
    const cached = this.decodedSegmentCache[index];
    if (cached !== undefined) {
      return cached;
    }
    const value = decodeURIComponentSafe(this.segments[index]!, this.encodedSlashBehavior);
    this.decodedSegmentCache[index] = value;
    return value;
  }

  private buildParams(): { params: RouteParams; snapshot?: Array<[string, string | undefined]> } {
    const bag = Object.create(null) as RouteParams;
    let snapshot: Array<[string, string | undefined]> | undefined;
    if (this.captureSnapshot) {
      snapshot = new Array(this.paramCount);
    }
    for (let i = 0; i < this.paramCount; i++) {
      const name = this.paramNames[i]!;
      const value = this.paramValues[i]!;
      bag[name] = value;
      if (snapshot) {
        snapshot[i] = [name, value];
      }
    }
    return { params: bag, snapshot };
  }
}
