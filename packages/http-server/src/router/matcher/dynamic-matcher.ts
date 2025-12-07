import type { RouteKey } from '../../types';
import type { HttpMethod } from '../enums';
import type { ImmutableRouterLayout, SerializedNodeRecord } from '../layout/immutable-router-layout';
import type {
  DynamicMatchResult,
  DynamicMatcherConfig,
  EncodedSlashBehavior,
  MatchObserverHooks,
  PatternTesterFn,
  RouteParams,
} from '../types';

import { FrameStage, type MatchFrame } from './match-frame';
import { ParamDecoder } from './param-decoder';
import { createParamStage, type ParamStageHandler } from './stage-param';
import { createStaticStage, type StaticStageHandler } from './stage-static';
import { createWildcardStage, type WildcardStageHandler } from './stage-wildcard';
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
  private readonly segmentHints?: Uint8Array;
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
  private readonly failFastOnBadEncoding: boolean;

  private paramNames: string[] = [];
  private paramValues: string[] = [];
  private paramCount = 0;
  private suffixHelper?: WildcardSuffixCache;
  private paramDecoder: ParamDecoder;
  private runStaticStage: StaticStageHandler;
  private runParamStage: ParamStageHandler;
  private runWildcardStage: WildcardStageHandler;

  constructor(config: DynamicMatcherConfig) {
    this.method = config.method;
    this.segments = config.segments;
    this.segmentHints = config.segmentDecodeHints;
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
    this.failFastOnBadEncoding = config.failFastOnBadEncoding;
    this.paramDecoder = new ParamDecoder({
      segments: this.segments,
      decodeParams: this.decodeParams,
      encodedSlashBehavior: this.encodedSlashBehavior,
      decodeHints: this.segmentHints,
      failFastOnBadEncoding: this.failFastOnBadEncoding,
    });
    if (this.hasWildcardRoutes) {
      this.suffixHelper = new WildcardSuffixCache({
        segments: this.segments,
        decodeParams: this.decodeParams,
        encodedSlashBehavior: this.encodedSlashBehavior,
        plan: config.suffixPlan,
        planFactory: config.suffixPlanFactory,
        paramDecoder: this.paramDecoder,
        failFastOnBadEncoding: this.failFastOnBadEncoding,
      });
    }
    if (this.suffixHelper) {
      this.suffixHelper.setParamDecoder?.(this.paramDecoder);
    }
    this.runStaticStage = createStaticStage({
      segments: this.segments,
      nodes: this.nodes,
      staticChildren: this.staticChildren,
      segmentChains: this.segmentChains,
      getParamCount: () => this.paramCount,
    });
    this.runParamStage = createParamStage({
      segmentsLength: this.segments.length,
      nodes: this.nodes,
      paramChildren: this.paramChildren,
      paramOrders: this.paramOrders,
      observer: this.observer,
      patternTesters: this.patternTesters,
      paramDecoder: this.paramDecoder,
      setParamCount: count => {
        this.paramCount = count;
      },
      getParamCount: () => this.paramCount,
      pushParam: (name, value) => this.pushParam(name, value),
    });
    this.runWildcardStage = createWildcardStage({
      nodes: this.nodes,
      segments: this.segments,
      suffixHelper: this.suffixHelper,
      lookupMethodKey: node => this.lookupMethodKey(node),
      pushParam: (name, value) => this.pushParam(name, value),
      setParamCount: count => {
        this.paramCount = count;
      },
    });
  }

  private static methodMaskHas(mask: number, method: HttpMethod): boolean {
    const numeric = Number(method);
    if (numeric < 0) {
      return false;
    }
    if (numeric >= 31) {
      return true;
    }
    return (mask & (1 << numeric)) !== 0;
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
          result = this.runStaticStage(frame, stack);
          break;
        case FrameStage.Params:
          result = this.runParamStage(frame, stack);
          break;
        case FrameStage.Wildcard:
          result = this.runWildcardStage(frame);
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
    if (node.methodMask && !DynamicMatcher.methodMaskHas(node.methodMask, this.method)) {
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

  private pushParam(name: string, value: string): void {
    this.paramNames[this.paramCount] = name;
    this.paramValues[this.paramCount] = value;
    this.paramCount++;
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
