import { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import { NodeKind } from '../enums';
import { buildImmutableLayout, type ImmutableRouterLayout, type SerializedNodeRecord } from '../layout/immutable-router-layout';
import { DynamicMatcher } from '../matcher/dynamic-matcher';
import { RouterNode } from '../node/router-node';
import { buildPatternTester, type PatternTesterOptions } from '../pattern/pattern-tester';
import { assessRegexSafety } from '../pattern/regex-guard';
import { matchStaticParts, splitStaticChain } from '../tree/tree-utils';
import type {
  DynamicMatchResult,
  MatchObserverHooks,
  PatternTesterFn,
  RouterOptions,
  RouteMatch,
  RouteParams,
  StaticProbeResult,
  RouterSnapshotMetadata,
  NormalizedPathSegments,
  EncodedSlashBehavior,
  ParamOrderSnapshot,
  SuffixPlan,
  PipelineStageConfig,
} from '../types';
import { normalizeAndSplit } from '../utils/path-utils';

import { createBuildPipeline } from './build-pipeline';
import { MatchRunner } from './match-runner';
import { OptionalParamDefaults } from './optional-param-defaults';
import { RouterCache } from './router-cache';
import type { NormalizedRouterOptions } from './router-options';
import { normalizeParamOrderOptions, normalizePipelineStages, normalizeRegexSafety } from './router-options';
import { StaticFastRegistry } from './static-fast-registry';

let GLOBAL_ROUTE_KEY_SEQ = 1 as RouteKey;

type RegExpConstructorWithEscape = RegExpConstructor & { escape?: (value: string) => string };
const REGEXP_WITH_ESCAPE = RegExp as RegExpConstructorWithEscape;

const escapeRegexLiteral = (value: string): string => {
  if (typeof REGEXP_WITH_ESCAPE.escape === 'function') {
    return REGEXP_WITH_ESCAPE.escape(value);
  }
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const START_ANCHOR_PATTERN = new RegExp(`^(?:${escapeRegexLiteral('^')})+`);
const END_ANCHOR_PATTERN = new RegExp(`(?:${escapeRegexLiteral('$')})+$`);

export class RadixRouterCore {
  private root: RouterNode | null;
  private options: NormalizedRouterOptions;
  private cacheStore: RouterCache;
  private matchRunner: MatchRunner;
  private staticFastRegistry: StaticFastRegistry;
  private patternTesterOptions?: PatternTesterOptions;
  private wildcardMethodsByMethod: Record<number, true> | null = null;
  private wildcardRouteCount = 0;
  private hasWildcardRoutes = false;
  private hasDynamicRoutes = false;
  private sealed = false;
  private routeCount = 0;
  private layout?: ImmutableRouterLayout;
  private patternTesters: ReadonlyArray<PatternTesterFn | undefined> = [];
  private matchObserver: MatchObserverHooks;
  private optionalDefaults: OptionalParamDefaults;
  private paramOrders: ReadonlyArray<Uint16Array | null> = [];
  private paramEdgeHitCounts: Uint32Array = new Uint32Array(0);
  private paramReseedThresholds: Uint32Array = new Uint32Array(0);
  private metadata: RouterSnapshotMetadata = Object.freeze({
    totalRoutes: 0,
    hasDynamicRoutes: false,
    hasWildcardRoutes: false,
    wildcardRouteCount: 0,
    methodsWithWildcard: [],
    builtAt: 0,
  });
  private globalParamNames: Set<string> | null;
  private stageConfig: PipelineStageConfig;

  constructor(options?: RouterOptions) {
    const regexSafety = normalizeRegexSafety(options?.regexSafety);
    const encodedSlashBehavior: EncodedSlashBehavior =
      options?.encodedSlashBehavior ?? (options?.preserveEncodedSlashes ? 'preserve' : 'decode');
    const paramOrderTuning = normalizeParamOrderOptions(options?.paramOrderTuning);
    this.options = {
      ignoreTrailingSlash: options?.ignoreTrailingSlash ?? true,
      collapseSlashes: options?.collapseSlashes ?? true,
      caseSensitive: options?.caseSensitive ?? true,
      decodeParams: options?.decodeParams ?? true,
      preserveEncodedSlashes: encodedSlashBehavior === 'preserve',
      encodedSlashBehavior,
      blockTraversal: options?.blockTraversal ?? true,
      enableCache: options?.enableCache ?? false,
      cacheSize: options?.cacheSize ?? 1024,
      strictParamNames: options?.strictParamNames ?? false,
      optionalParamBehavior: options?.optionalParamBehavior ?? 'omit',
      pipelineStages: options?.pipelineStages ?? {},
      regexSafety,
      regexAnchorPolicy: options?.regexAnchorPolicy ?? 'warn',
      paramOrderTuning,
    };
    this.stageConfig = normalizePipelineStages(options?.pipelineStages);
    this.cacheStore = new RouterCache(this.options);
    this.staticFastRegistry = new StaticFastRegistry(this.options);
    this.optionalDefaults = new OptionalParamDefaults(this.options.optionalParamBehavior);
    this.matchRunner = this.createMatchRunner();
    this.root = new RouterNode(NodeKind.Static, '');
    this.patternTesterOptions = this.buildPatternTesterOptions();
    this.matchObserver = {
      onParamBranch: (nodeIndex, offset) => {
        this.recordParamUsage(nodeIndex, offset);
      },
    };
    this.globalParamNames = this.options.strictParamNames ? new Set() : null;
  }

  addAll(entries: Array<[HttpMethod, string]>): RouteKey[] {
    this.assertMutable();
    const keys: RouteKey[] = new Array(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const [method, path] = entries[i]!;
      const prepared = normalizeAndSplit(path, this.options);
      const key = this.insertRoute(method, path, prepared);
      keys[i] = key;
      this.registerStaticFastRoute(method, prepared.normalized, path, key);
      this.afterRouteInsertion();
    }
    return keys;
  }

  add(method: HttpMethod | HttpMethod[] | '*', path: string): RouteKey | RouteKey[] {
    this.assertMutable();
    if (method === '*') {
      const methods = Object.values(HttpMethod).filter(v => typeof v === 'number') as HttpMethod[];
      return this.addAll(methods.map(m => [m, path]));
    }
    if (Array.isArray(method)) {
      return this.addAll(method.map(m => [m, path]));
    }
    const prepared = normalizeAndSplit(path, this.options);
    const key = this.insertRoute(method, path, prepared);
    this.registerStaticFastRoute(method, prepared.normalized, path, key);
    this.afterRouteInsertion();
    return key;
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    return this.matchRunner.run(method, path);
  }

  finalizeBuild(): void {
    if (this.sealed) {
      return;
    }
    const root = this.requireBuilderRoot();
    this.runBuildPipeline(root);
    this.layout = buildImmutableLayout(root);
    this.patternTesters = this.buildLayoutPatternTesters(this.layout);
    this.initializeParamOrderingStructures();
    this.hydrateParamOrderingSnapshot();
    this.sealed = true;
    this.releaseBuilderState();
  }

  getMetadata(): RouterSnapshotMetadata {
    return this.metadata;
  }

  getLayoutSnapshot(): ImmutableRouterLayout | undefined {
    return this.layout;
  }

  exportParamOrderingSnapshot(): ParamOrderSnapshot | null {
    if (!this.paramEdgeHitCounts.length) {
      return null;
    }
    return { edgeHits: Array.from(this.paramEdgeHitCounts) };
  }

  private createMatchRunner(): MatchRunner {
    return new MatchRunner({
      options: this.options,
      cache: this.cacheStore,
      staticRegistry: this.staticFastRegistry,
      optionalDefaults: this.optionalDefaults,
      stageConfig: this.stageConfig,
      buildStaticMatch: key => this.buildStaticMatch(key),
      tryStaticFast: (method, path) => this.tryStaticFastMatch(method, path),
      findDynamicMatch: (method, segments, captureSnapshot, suffixPlan, methodHasWildcard) =>
        this.findDynamicMatch(method, segments, captureSnapshot, suffixPlan, methodHasWildcard),
      buildWildcardSuffixPlan: (segments, normalized) => this.buildWildcardSuffixPlan(segments, normalized),
      methodHasWildcard: method => this.methodHasWildcard(method),
    });
  }

  private tryStaticFastMatch(method: HttpMethod, path: string): StaticProbeResult {
    return this.staticFastRegistry.tryMatch(method, path, key => this.buildStaticMatch(key));
  }

  private findDynamicMatch(
    method: HttpMethod,
    segments: string[],
    captureSnapshot: boolean,
    suffixPlan: SuffixPlan | undefined,
    methodHasWildcard: boolean,
  ): DynamicMatchResult | null {
    if (!this.layout) {
      throw new Error('Router has not been finalized. Call build() before matching.');
    }
    const matcher = new DynamicMatcher({
      method,
      segments,
      decodeParams: this.options.decodeParams,
      hasWildcardRoutes: methodHasWildcard,
      captureSnapshot,
      suffixPlan,
      layout: this.layout,
      patternTesters: this.patternTesters,
      paramOrders: this.paramOrders,
      observer: this.matchObserver,
      encodedSlashBehavior: this.options.encodedSlashBehavior,
    });
    return matcher.match();
  }

  private registerStaticFastRoute(method: HttpMethod, normalizedPath: string, sourcePath: string, key: RouteKey): void {
    this.staticFastRegistry.registerRoute(method, normalizedPath, sourcePath, key);
  }

  private buildStaticMatch(key: RouteKey): RouteMatch {
    const params = Object.create(null) as RouteParams;
    this.optionalDefaults.apply(key, params);
    return { key, params };
  }

  private afterRouteInsertion(): void {
    this.cacheStore.bumpVersion();
  }

  private registerGlobalParamName(name: string): void {
    if (!this.globalParamNames) {
      return;
    }
    if (this.globalParamNames.has(name)) {
      throw new Error(`Parameter name ':${name}' is already registered while strictParamNames is enabled`);
    }
    this.globalParamNames.add(name);
  }

  private insertRoute(method: HttpMethod, path: string, prepared?: NormalizedPathSegments): RouteKey {
    const preparedPath = prepared ?? normalizeAndSplit(path, this.options);
    const { segments } = preparedPath;
    let firstKey: RouteKey | null = null;
    const describeContext = (idx: number): string => segments.slice(0, idx).join('/');
    const registerParamName = (name: string, active: Set<string>): (() => void) => {
      if (active.has(name)) {
        throw new Error(`Duplicate parameter name ':${name}' detected in path: ${path}`);
      }
      active.add(name);
      return () => {
        active.delete(name);
      };
    };
    const addSegments = (node: RouterNode, idx: number, activeParams: Set<string>, omittedOptionals: readonly string[]): void => {
      if (idx === segments.length) {
        const existing = node.methods.byMethod.get(method);
        if (existing !== undefined) {
          throw new Error(`Route already exists for ${this.describeMethod(method)} at path: ${path}`);
        }
        const key = GLOBAL_ROUTE_KEY_SEQ++ as unknown as RouteKey;
        node.methods.byMethod.set(method, key);
        this.routeCount++;
        if (firstKey === null) {
          firstKey = key;
        }
        if (omittedOptionals.length) {
          this.optionalDefaults.record(key, omittedOptionals);
        }
        return;
      }
      const seg = segments[idx]!;
      if (seg.charCodeAt(0) === 42 /* '*' */) {
        // Conflict: wildcard cannot coexist with other children (would shadow them)
        if (node.staticChildren.size || node.paramChildren.length) {
          throw new Error(`Conflict: adding wildcard '*' at '${describeContext(idx)}' would shadow existing routes`);
        }
        if (idx !== segments.length - 1) {
          throw new Error("Wildcard '*' must be the last segment");
        }
        const name = seg.length > 1 ? seg.slice(1) : '*';
        if (node.wildcardChild) {
          const existing = node.wildcardChild;
          if (existing.wildcardOrigin !== 'star' || existing.segment !== name) {
            throw new Error(`Conflict: wildcard '${existing.segment}' already exists at '${describeContext(idx)}'`);
          }
        } else {
          this.registerGlobalParamName(name);
          node.wildcardChild = new RouterNode(NodeKind.Wildcard, name);
          node.wildcardChild.wildcardOrigin = 'star';
        }
        const release = registerParamName(name, activeParams);
        try {
          addSegments(node.wildcardChild, idx + 1, activeParams, omittedOptionals);
        } finally {
          release();
        }
        return;
      }
      if (seg.charCodeAt(0) === 58 /* ':' */) {
        let optional = false;
        let core = seg;
        if (seg.endsWith('?')) {
          optional = true;
          core = seg.slice(0, -1);
        }
        let multi = false;
        if (core.endsWith('+')) {
          multi = true;
          core = core.slice(0, -1);
        }
        let zeroOrMore = false;
        if (core.endsWith('*')) {
          zeroOrMore = true;
          core = core.slice(0, -1);
        }
        const brace = core.indexOf('{');
        let name = '';
        let patternSrc: string | undefined;
        if (brace === -1) {
          name = core.slice(1);
        } else {
          name = core.slice(1, brace);
          if (!core.endsWith('}')) {
            throw new Error("Parameter regex must close with '}'");
          }
          patternSrc = core.slice(brace + 1, -1) || undefined;
        }
        if (!name) {
          throw new Error("Parameter segment must have a name, eg ':id'");
        }
        let releaseNameCallback: (() => void) | null = null;
        const acquireParamName = (): (() => void) => {
          if (!releaseNameCallback) {
            releaseNameCallback = registerParamName(name, activeParams);
          }
          return releaseNameCallback;
        };

        if (zeroOrMore && optional) {
          throw new Error(`Parameter ':${name}*' already allows empty matches; do not combine '*' and '?' suffixes`);
        }
        if (optional) {
          const nextOmitted = omittedOptionals.length ? [...omittedOptionals, name] : [name];
          addSegments(node, idx + 1, activeParams, nextOmitted);
        }

        if (zeroOrMore) {
          if (idx !== segments.length - 1) {
            throw new Error("Zero-or-more param ':name*' must be the last segment");
          }
          if (!node.wildcardChild) {
            this.registerGlobalParamName(name);
            node.wildcardChild = new RouterNode(NodeKind.Wildcard, name || '*');
            node.wildcardChild.wildcardOrigin = 'zero';
          } else if (node.wildcardChild.wildcardOrigin !== 'zero' || node.wildcardChild.segment !== name) {
            throw new Error(
              `Conflict: zero-or-more parameter ':${name}*' cannot reuse wildcard '${node.wildcardChild.segment}' at '${describeContext(idx)}'`,
            );
          }
          const releaseName = acquireParamName();
          try {
            addSegments(node.wildcardChild, idx + 1, activeParams, omittedOptionals);
          } finally {
            releaseName();
          }
          return;
        }
        if (multi) {
          if (idx !== segments.length - 1) {
            throw new Error("Multi-segment param ':name+' must be the last segment");
          }
          if (!node.wildcardChild) {
            this.registerGlobalParamName(name);
            node.wildcardChild = new RouterNode(NodeKind.Wildcard, name || '*');
            node.wildcardChild.wildcardOrigin = 'multi';
          } else if (node.wildcardChild.wildcardOrigin !== 'multi' || node.wildcardChild.segment !== name) {
            throw new Error(
              `Conflict: multi-parameter ':${name}+' cannot reuse wildcard '${node.wildcardChild.segment}' at '${describeContext(idx)}'`,
            );
          }
          const releaseName = acquireParamName();
          try {
            addSegments(node.wildcardChild, idx + 1, activeParams, omittedOptionals);
          } finally {
            releaseName();
          }
          return;
        }
        const releaseName = acquireParamName();
        let child: RouterNode | undefined;
        for (const c of node.paramChildren) {
          if (c.segment === name && (c.pattern?.source ?? undefined) === (patternSrc ?? undefined)) {
            child = c;
            break;
          }
        }
        if (!child) {
          // Conflict: same name with different regex already present
          const dup = node.paramChildren.find(c => c.segment === name && (c.pattern?.source ?? '') !== (patternSrc ?? ''));
          if (dup) {
            throw new Error(`Conflict: parameter ':${name}' with different regex already exists at '${describeContext(idx)}'`);
          }
          // Conflict: attempting to add param beneath a wildcard sibling
          if (node.wildcardChild) {
            throw new Error(`Conflict: adding parameter ':${name}' under existing wildcard at '${describeContext(idx)}'`);
          }
          this.registerGlobalParamName(name);
          child = new RouterNode(NodeKind.Param, name);
          if (patternSrc) {
            const normalizedPattern = this.normalizeParamPatternSource(patternSrc);
            this.ensureRegexSafe(normalizedPattern);
            child.pattern = new RegExp(`^(?:${normalizedPattern})$`);
            child.patternSource = normalizedPattern;
            child.patternTester = buildPatternTester(normalizedPattern, child.pattern, this.patternTesterOptions);
          }
          node.paramChildren.push(child);
          this.sortParamChildren(node);
        }
        try {
          addSegments(child, idx + 1, activeParams, omittedOptionals);
        } finally {
          releaseName();
        }
        return;
      }
      let child = node.staticChildren.get(seg);
      if (!child && node.wildcardChild) {
        // Conflict: static segment would be shadowed by existing wildcard
        throw new Error(`Conflict: adding static segment '${seg}' under existing wildcard at '${describeContext(idx)}'`);
      }
      if (child) {
        const parts = child.segmentParts;
        if (parts && parts.length > 1) {
          const matched = matchStaticParts(parts, segments, idx);
          if (matched < parts.length) {
            splitStaticChain(child, matched);
          }
          if (matched > 1) {
            addSegments(child, idx + matched, activeParams, omittedOptionals);
            return;
          }
        }
        addSegments(child, idx + 1, activeParams, omittedOptionals);
        return;
      }
      child = new RouterNode(NodeKind.Static, seg);
      node.staticChildren.set(seg, child);
      addSegments(child, idx + 1, activeParams, omittedOptionals);
    };
    addSegments(this.requireBuilderRoot(), 0, new Set(), []);
    return firstKey!;
  }

  private sortParamChildren(node: RouterNode): void {
    if (node.paramChildren.length < 2) {
      return;
    }
    node.paramChildren.sort((a, b) => {
      const hotDiff = (b.paramHitCount ?? 0) - (a.paramHitCount ?? 0);
      if (hotDiff !== 0) {
        return hotDiff;
      }
      const weight = (child: RouterNode) => (child.pattern ? 0 : 1);
      const diff = weight(a) - weight(b);
      if (diff !== 0) {
        return diff;
      }
      if (a.pattern && b.pattern) {
        const aLen = a.patternSource?.length ?? 0;
        const bLen = b.patternSource?.length ?? 0;
        if (aLen !== bLen) {
          return bLen - aLen;
        }
      }
      return a.segment.localeCompare(b.segment);
    });
  }

  private assertMutable(): void {
    if (this.sealed) {
      throw new Error('Router has already been sealed. Instantiate a new builder to add more routes.');
    }
  }

  private requireBuilderRoot(): RouterNode {
    if (!this.root) {
      throw new Error('Router builder state is no longer available. Instantiate a new builder to add routes.');
    }
    return this.root;
  }

  private releaseBuilderState(): void {
    this.root = null;
  }

  private describeMethod(method: HttpMethod): string {
    const reversed = (HttpMethod as unknown as Record<number, string>)[method as number];
    if (typeof reversed === 'string') {
      return reversed.toUpperCase();
    }
    return String(method);
  }

  private buildPatternTesterOptions(): PatternTesterOptions | undefined {
    const limit = this.options.regexSafety.maxExecutionMs;
    if (!limit || limit <= 0) {
      return undefined;
    }
    return {
      maxExecutionMs: limit,
      onTimeout: (pattern, duration) => {
        const base = `Route parameter regex '${pattern}' exceeded ${limit}ms (took ${duration.toFixed(3)}ms)`;
        const shouldThrow = this.options.regexSafety.mode !== 'warn';
        if (!shouldThrow) {
          console.warn(`[bunner/router] ${base}`);
          return false;
        }
        console.error(`[bunner/router] ${base}`);
        return true;
      },
    };
  }

  private ensureRegexSafe(patternSrc: string): void {
    const safety = this.options.regexSafety;
    const result = assessRegexSafety(patternSrc, {
      maxLength: safety.maxLength,
      forbidBacktrackingTokens: safety.forbidBacktrackingTokens,
      forbidBackreferences: safety.forbidBackreferences,
    });
    if (!result.safe) {
      const reason = result.reason ? ` (${result.reason})` : '';
      const message = `Unsafe route regex '${patternSrc}'${reason}`;
      if (safety.mode === 'warn') {
        console.warn(`[bunner/router] ${message}`);
      } else {
        throw new Error(message);
      }
    }
    safety.validator?.(patternSrc);
  }

  private buildWildcardSuffixPlan(segments: string[], normalizedPath: string): SuffixPlan | undefined {
    if (!segments.length || normalizedPath.length <= 1) {
      return undefined;
    }
    const source = normalizedPath.charCodeAt(0) === 47 ? normalizedPath.slice(1) : normalizedPath;
    if (!source.length) {
      return undefined;
    }
    const offsets = new Uint32Array(segments.length + 1);
    let cursor = 0;
    for (let i = 0; i < segments.length; i++) {
      offsets[i] = cursor;
      cursor += segments[i]!.length;
      if (i !== segments.length - 1) {
        cursor++;
      }
    }
    offsets[segments.length] = cursor;
    return { source, offsets };
  }

  private normalizeParamPatternSource(patternSrc: string): string {
    let normalized = patternSrc.trim();
    if (!normalized) {
      return normalized;
    }
    let removedAnchors = false;
    if (START_ANCHOR_PATTERN.test(normalized)) {
      removedAnchors = true;
      normalized = normalized.replace(START_ANCHOR_PATTERN, '');
    }
    if (END_ANCHOR_PATTERN.test(normalized)) {
      removedAnchors = true;
      normalized = normalized.replace(END_ANCHOR_PATTERN, '');
    }
    if (!normalized) {
      normalized = '.*';
      removedAnchors = true;
    }
    if (removedAnchors) {
      const message = `[bunner/router] Parameter regex '${patternSrc}' declares '^' or '$' anchors. Bunner wraps patterns automatically, so anchors are stripped.`;
      const policy = this.options.regexAnchorPolicy;
      if (policy === 'error') {
        throw new Error(message);
      }
      if (policy === 'warn') {
        console.warn(message);
      }
    }
    return normalized;
  }

  private runBuildPipeline(root: RouterNode): void {
    const pipeline = createBuildPipeline({
      stageConfig: this.stageConfig,
      routeCount: this.routeCount,
      ensureRegexSafe: pattern => this.ensureRegexSafe(pattern),
      markRouteHints: (hasDynamic, hasWildcard) => this.staticFastRegistry.markRouteHints(hasDynamic, hasWildcard),
      initialWildcardRouteCount: this.wildcardRouteCount,
      initialWildcardMethodsByMethod: this.wildcardMethodsByMethod,
      initialHasDynamicRoutes: this.hasDynamicRoutes,
      initialHasWildcardRoutes: this.hasWildcardRoutes,
      currentMetadata: this.metadata,
    });
    const result = pipeline.execute(root);
    this.wildcardRouteCount = result.wildcardRouteCount;
    this.wildcardMethodsByMethod = result.wildcardMethodsByMethod;
    this.hasDynamicRoutes = result.hasDynamicRoutes;
    this.hasWildcardRoutes = result.hasWildcardRoutes;
    this.metadata = result.metadata;
  }

  private buildLayoutPatternTesters(layout: ImmutableRouterLayout): ReadonlyArray<PatternTesterFn | undefined> {
    if (!layout.patterns.length) {
      return [];
    }
    const testers = new Array<PatternTesterFn | undefined>(layout.patterns.length);
    for (let i = 0; i < layout.patterns.length; i++) {
      const pattern = layout.patterns[i]!;
      if (!pattern.source) {
        testers[i] = undefined;
        continue;
      }
      const flags = pattern.flags ?? '';
      const compiled = new RegExp(`^(?:${pattern.source})$`, flags);
      testers[i] = buildPatternTester(pattern.source, compiled, this.patternTesterOptions);
    }
    return testers;
  }

  private initializeParamOrderingStructures(): void {
    const layout = this.layout;
    if (!layout) {
      this.paramOrders = [];
      this.paramEdgeHitCounts = new Uint32Array(0);
      this.paramReseedThresholds = new Uint32Array(0);
      return;
    }
    this.paramEdgeHitCounts = new Uint32Array(layout.paramChildren.length);
    this.paramReseedThresholds = new Uint32Array(layout.nodes.length);
    const orders: Array<Uint16Array | null> = new Array(layout.nodes.length);
    for (let i = 0; i < layout.nodes.length; i++) {
      const node = layout.nodes[i]!;
      if (node.paramRangeCount > 1) {
        const order = new Uint16Array(node.paramRangeCount);
        for (let j = 0; j < node.paramRangeCount; j++) {
          order[j] = j;
        }
        orders[i] = order;
      } else {
        orders[i] = null;
      }
      this.paramReseedThresholds[i] = this.options.paramOrderTuning.baseThreshold;
    }
    this.paramOrders = orders;
  }

  private hydrateParamOrderingSnapshot(): void {
    const snapshot = this.options.paramOrderTuning.snapshot;
    if (!snapshot || !snapshot.edgeHits.length || !this.paramEdgeHitCounts.length) {
      return;
    }
    const limit = Math.min(snapshot.edgeHits.length, this.paramEdgeHitCounts.length);
    for (let i = 0; i < limit; i++) {
      this.paramEdgeHitCounts[i] = snapshot.edgeHits[i]!;
    }
    if (!this.layout) {
      return;
    }
    for (let nodeIndex = 0; nodeIndex < this.layout.nodes.length; nodeIndex++) {
      const node = this.layout.nodes[nodeIndex]!;
      if (node.paramRangeCount > 1) {
        this.resortParamOrder(nodeIndex, node);
      }
    }
  }

  private recordParamUsage(nodeIndex: number, localOffset: number): void {
    const layout = this.layout;
    if (!layout) {
      return;
    }
    const node = layout.nodes[nodeIndex];
    if (!node || node.paramRangeCount < 2) {
      return;
    }
    const order = this.paramOrders[nodeIndex];
    if (!order) {
      return;
    }
    const edgeIndex = node.paramRangeStart + localOffset;
    if (edgeIndex >= this.paramEdgeHitCounts.length) {
      return;
    }
    const current = this.paramEdgeHitCounts[edgeIndex] ?? 0;
    const hits = current + 1;
    this.paramEdgeHitCounts[edgeIndex] = hits;
    const tuning = this.options.paramOrderTuning;
    const threshold = this.paramReseedThresholds[nodeIndex] || tuning.baseThreshold;
    if (hits < threshold) {
      return;
    }
    if (Math.random() > tuning.reseedProbability) {
      this.paramReseedThresholds[nodeIndex] = threshold + tuning.baseThreshold;
      return;
    }
    this.resortParamOrder(nodeIndex, node);
    this.paramReseedThresholds[nodeIndex] = threshold + tuning.baseThreshold;
  }

  private resortParamOrder(nodeIndex: number, node: SerializedNodeRecord): void {
    const order = this.paramOrders[nodeIndex];
    if (!order) {
      return;
    }
    const start = node.paramRangeStart;
    const count = node.paramRangeCount;
    const offsets = new Array<number>(count);
    for (let i = 0; i < count; i++) {
      offsets[i] = order[i] as number;
    }
    offsets.sort((a, b) => {
      const hitsA = this.paramEdgeHitCounts[start + a] ?? 0;
      const hitsB = this.paramEdgeHitCounts[start + b] ?? 0;
      if (hitsA === hitsB) {
        return a - b;
      }
      return hitsB - hitsA;
    });
    for (let i = 0; i < count; i++) {
      order[i] = offsets[i]!;
    }
  }

  private methodHasWildcard(method: HttpMethod): boolean {
    if (!this.wildcardMethodsByMethod) {
      return this.wildcardRouteCount > 0 ? this.hasWildcardRoutes : false;
    }
    return Boolean(this.wildcardMethodsByMethod[method as number]);
  }
}
