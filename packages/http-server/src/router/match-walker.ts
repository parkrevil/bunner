import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import type { ImmutableRouterLayout, SerializedNodeRecord } from './immutable-layout';
import { ROUTE_REGEX_TIMEOUT } from './pattern-tester';
import { matchStaticParts } from './tree-utils';
import type {
  DynamicMatchResult,
  DynamicMatcherConfig,
  EncodedSlashBehavior,
  MatchObserverHooks,
  PatternTesterFn,
} from './types';
import { decodeURIComponentSafe } from './utils';

const enum FrameStage {
  Enter,
  Static,
  Params,
  Wildcard,
  Exit,
}

type MatchFrame = {
  nodeIndex: number;
  segmentIndex: number;
  stage: FrameStage;
  paramBase: number;
  paramCursor: number;
  decodedSegment?: string;
};

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
  private suffixCache?: Array<string | undefined>;
  private decodedSuffixCache?: Array<string | undefined>;
  private suffixOffsets?: number[];
  private suffixSource?: string;

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
    this.suffixSource = config.suffixSource;
    this.paramOrders = config.paramOrders;
    this.observer = config.observer;
    this.encodedSlashBehavior = config.encodedSlashBehavior;
    if (this.hasWildcardRoutes) {
      this.ensureSuffixCache();
    }
  }

  match(): DynamicMatchResult | null {
    const key = this.walk();
    if (key === null) {
      return null;
    }
    if (!this.paramCount) {
      return { key, params: Object.create(null) };
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
      const node = this.nodes[frame.nodeIndex]!;
      switch (frame.stage) {
        case FrameStage.Enter: {
          if (frame.segmentIndex === this.segments.length) {
            const found = this.lookupMethodKey(node);
            if (found !== null) {
              return found;
            }
            frame.stage = FrameStage.Exit;
            continue;
          }
          frame.stage = FrameStage.Static;
          continue;
        }
        case FrameStage.Static: {
          if (frame.segmentIndex >= this.segments.length || node.staticRangeCount === 0) {
            frame.stage = FrameStage.Params;
            continue;
          }
          const childIndex = this.findStaticChild(node, this.segments[frame.segmentIndex]!);
          frame.stage = FrameStage.Params;
          if (childIndex === -1) {
            continue;
          }
          const child = this.nodes[childIndex]!;
          const chain = this.getSegmentParts(child);
          if (chain && chain.length > 1) {
            const matched = matchStaticParts(chain, this.segments, frame.segmentIndex);
            if (matched !== chain.length) {
              continue;
            }
            stack.push({
              nodeIndex: childIndex,
              segmentIndex: frame.segmentIndex + matched,
              stage: FrameStage.Enter,
              paramBase: this.paramCount,
              paramCursor: 0,
            });
            continue;
          }
          stack.push({
            nodeIndex: childIndex,
            segmentIndex: frame.segmentIndex + 1,
            stage: FrameStage.Enter,
            paramBase: this.paramCount,
            paramCursor: 0,
          });
          continue;
        }
        case FrameStage.Params: {
          if (frame.segmentIndex >= this.segments.length || node.paramRangeCount === 0) {
            frame.stage = FrameStage.Wildcard;
            frame.decodedSegment = undefined;
            continue;
          }
          if (frame.paramCursor >= node.paramRangeCount) {
            frame.stage = FrameStage.Wildcard;
            frame.decodedSegment = undefined;
            continue;
          }
          this.paramCount = frame.paramBase;
          frame.decodedSegment ??= this.getDecodedSegment(frame.segmentIndex);
          const decoded = frame.decodedSegment;
          const order = this.paramOrders ? this.paramOrders[frame.nodeIndex] : null;
          const orderedOffset = order ? order[frame.paramCursor] : frame.paramCursor;
          if (orderedOffset === undefined || orderedOffset >= node.paramRangeCount) {
            frame.stage = FrameStage.Wildcard;
            frame.decodedSegment = undefined;
            continue;
          }
          frame.paramCursor++;
          const edge = this.paramChildren[node.paramRangeStart + orderedOffset]!;
          const childIndex = edge.target;
          const child = this.nodes[childIndex]!;
          if (!this.testParamPattern(child.patternIndex, decoded)) {
            continue;
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
          continue;
        }
        case FrameStage.Wildcard: {
          frame.stage = FrameStage.Exit;
          const wildcardIndex = node.wildcardChild;
          if (wildcardIndex === -1) {
            continue;
          }
          this.paramCount = frame.paramBase;
          const wildcard = this.nodes[wildcardIndex]!;
          const key = this.lookupMethodKey(wildcard);
          if (key === null) {
            continue;
          }
          const wildcardName = wildcard.segment || '*';
          const wildcardValue = this.getSuffixValue(frame.segmentIndex);
          this.pushParam(wildcardName, wildcardValue);
          return key;
        }
        case FrameStage.Exit: {
          this.paramCount = frame.paramBase;
          stack.pop();
          continue;
        }
        default: {
          stack.pop();
          continue;
        }
      }
    }

    return null;
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

  private getSuffixValue(index: number): string {
    if (!this.hasWildcardRoutes) {
      return '';
    }
    this.ensureSuffixCache();
    if (!this.suffixCache || !this.suffixOffsets || !this.suffixSource) {
      return '';
    }
    let raw = this.suffixCache[index];
    if (raw === undefined) {
      raw = this.suffixSource.slice(this.suffixOffsets[index]);
      this.suffixCache[index] = raw;
    }
    if (!this.decodeParams || !raw) {
      return raw;
    }
    this.decodedSuffixCache ??= new Array<string | undefined>(this.segments.length);
    const cached = this.decodedSuffixCache[index];
    if (cached !== undefined) {
      return cached;
    }
    const value = decodeURIComponentSafe(raw, this.encodedSlashBehavior);
    this.decodedSuffixCache[index] = value;
    return value;
  }

  private ensureSuffixCache(): void {
    if (this.suffixOffsets || !this.hasWildcardRoutes || !this.segments.length) {
      return;
    }
    this.suffixCache = new Array(this.segments.length);
    this.suffixOffsets = new Array(this.segments.length);
    let offset = 0;
    for (let i = 0; i < this.segments.length; i++) {
      this.suffixOffsets[i] = offset;
      offset += this.segments[i]!.length;
      if (i !== this.segments.length - 1) {
        offset++;
      }
    }
    if (!this.suffixSource) {
      this.suffixSource = this.segments.join('/');
    }
  }

  private buildParams(): { params: Record<string, string>; snapshot?: Array<[string, string]> } {
    const bag = Object.create(null) as Record<string, string>;
    let snapshot: Array<[string, string]> | undefined;
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
