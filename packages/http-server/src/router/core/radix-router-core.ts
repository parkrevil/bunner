import { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import { NodeKind } from '../enums';
import type { BinaryRouterLayout } from '../layout/binary-router-layout';
import { compileToBinary } from '../layout/layout-compiler';
import { BinaryMatcher } from '../matcher/binary-matcher';
import { RouterNode } from '../node/router-node';
import { acquireRouterNode, releaseRouterSubtree } from '../node/router-node-pool';
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
  SuffixPlan,
  PipelineStageConfig,
} from '../types';
import { ensureSegmentOffsets, ensureSuffixSlices, type PathNormalizer } from '../utils/path-utils';

import { createBuildPipeline } from './build-pipeline';
import { MatchRunner } from './match-runner';
import { OptionalParamDefaults } from './optional-param-defaults';
import { createPathBehavior, type PathBehaviorProfile } from './path-behavior';
import { RouterCache } from './router-cache';
import type { NormalizedRouterOptions } from './router-options';
import {
  normalizeParamOrderOptions,
  normalizePipelineStages,
  normalizeRegexSafety,
  sanitizeMaxSegmentLength,
} from './router-options';
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
  private patternTesterCache = new Map<string, PatternTesterFn>();
  private compiledPatternCache = new Map<string, RegExp>();
  private wildcardMethodsByMethod: Record<number, true> | null = null;
  private wildcardRouteCount = 0;
  private hasWildcardRoutes = false;
  private hasDynamicRoutes = false;
  private sealed = false;
  private routeCount = 0;
  private layout?: BinaryRouterLayout;
  private binaryMatcher?: BinaryMatcher;
  private patternTesters: ReadonlyArray<PatternTesterFn | undefined> = [];
  private matchObserver: MatchObserverHooks;
  private optionalDefaults: OptionalParamDefaults;

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
  private normalizePath: PathNormalizer;
  private pathBehavior: PathBehaviorProfile;

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
      maxSegmentLength: sanitizeMaxSegmentLength(options?.maxSegmentLength),
      strictParamNames: options?.strictParamNames ?? false,
      optionalParamBehavior: options?.optionalParamBehavior ?? 'omit',
      regexSafety,
      regexAnchorPolicy: options?.regexAnchorPolicy ?? 'warn',
      paramOrderTuning,
      failFastOnBadEncoding: options?.failFastOnBadEncoding ?? false,
    };
    this.stageConfig = normalizePipelineStages(options?.pipelineStages);
    this.pathBehavior = createPathBehavior(this.options);
    this.normalizePath = this.pathBehavior.normalizePath;
    this.cacheStore = new RouterCache(this.options);
    this.staticFastRegistry = new StaticFastRegistry(this.pathBehavior);
    this.optionalDefaults = new OptionalParamDefaults(this.options.optionalParamBehavior);
    this.matchRunner = this.createMatchRunner();
    this.root = acquireRouterNode(NodeKind.Static, '');
    this.patternTesterOptions = this.buildPatternTesterOptions();
    this.matchObserver = {
      onParamBranch: (_nodeIndex, _offset) => {
        // Parameter tuning disabled for static performance stability
      },
    };
    this.globalParamNames = this.options.strictParamNames ? new Set() : null;
  }

  addAll(entries: Array<[HttpMethod, string]>): RouteKey[] {
    this.assertMutable();
    const keys: RouteKey[] = new Array(entries.length);
    let cachedPath: string | null = null;
    let cachedPrepared: NormalizedPathSegments | null = null;
    for (let i = 0; i < entries.length; i++) {
      const [method, path] = entries[i]!;
      let prepared: NormalizedPathSegments;
      if (cachedPath !== null && path === cachedPath && cachedPrepared) {
        prepared = cachedPrepared;
      } else {
        prepared = this.normalizePath(path);
        cachedPath = path;
        cachedPrepared = prepared;
      }
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
    const prepared = this.normalizePath(path);
    const key = this.insertRoute(method, path, prepared);
    this.registerStaticFastRoute(method, prepared.normalized, path, key);
    this.afterRouteInsertion();
    return key;
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    this.assertSealed();
    return this.matchRunner.run(method, path);
  }

  finalizeBuild(): void {
    if (this.sealed) {
      return;
    }
    const root = this.requireBuilderRoot();
    this.runBuildPipeline(root);
    // Serialize to Binary Layout
    this.layout = compileToBinary(root);

    // Pattern Testers (Must be built after compilation to match IDs, or before?)
    // LayoutCompiler generates `patterns` array.
    // We need to build testers from it.
    // Reusing buildLayoutPatternTesters but adapted for BinaryRouterLayout?
    // BinaryRouterLayout has `patterns` (SerializedPattern[]).
    // ImmutableRouterLayout had `patterns` too.
    // The signature matches `ReadonlyArray<SerializedPattern>`.
    this.patternTesters = this.buildLayoutPatternTesters(this.layout);

    // Initialize Binary Matcher
    this.binaryMatcher = new BinaryMatcher(this.layout, {
      patternTesters: this.patternTesters,
      encodedSlashBehavior: this.options.encodedSlashBehavior,
      failFastOnBadEncoding: this.options.failFastOnBadEncoding,
    });

    this.releaseBuilderState();
    this.sealed = true;
  }

  private createMatchRunner(): MatchRunner {
    return new MatchRunner({
      cache: this.cacheStore,
      staticRegistry: this.staticFastRegistry,
      optionalDefaults: this.optionalDefaults,
      stageConfig: this.stageConfig,
      normalizePath: (path: string) => this.normalizePath(path),
      buildStaticMatch: key => this.buildStaticMatch(key),
      tryStaticFast: (method, path) => this.tryStaticFastMatch(method, path),
      findDynamicMatch: (method, prepared, captureSnapshot, suffixPlanFactory, methodHasWildcard) =>
        this.findDynamicMatch(method, prepared, captureSnapshot, suffixPlanFactory, methodHasWildcard),
      buildWildcardSuffixPlan: prepared => this.buildWildcardSuffixPlan(prepared),
      methodHasWildcard: method => this.methodHasWildcard(method),
    });
  }

  private tryStaticFastMatch(method: HttpMethod, path: string): StaticProbeResult {
    return this.staticFastRegistry.tryMatch(method, path, key => this.buildStaticMatch(key));
  }

  private findDynamicMatch(
    method: HttpMethod,
    prepared: NormalizedPathSegments,
    captureSnapshot: boolean,
    suffixPlanFactory: (() => SuffixPlan | undefined) | undefined,
  ): DynamicMatchResult | null {
    if (!this.binaryMatcher) {
      throw new Error('Router has not been finalized. Call build() before matching.');
    }
    // Reuse binary matcher
    return this.binaryMatcher.exec(
      method,
      prepared.segments,
      prepared.segmentDecodeHints,
      this.options.decodeParams,
      captureSnapshot,
      suffixPlanFactory,
    );
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
    const preparedPath = prepared ?? this.normalizePath(path);
    const { segments } = preparedPath;
    let firstKey: RouteKey | null = null;
    const describeContext = (idx: number): string => segments.slice(0, idx).join('/');
    const registerParamName = (name: string, active: Set<string>): (() => void) => {
      if (active.has(name)) {
        throw new Error(`Duplicate parameter name ':${name}' detected in path: ${path} `);
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
          throw new Error(`Route already exists for ${this.describeMethod(method)} at path: ${path} `);
        }
        const key = GLOBAL_ROUTE_KEY_SEQ++ as unknown as RouteKey;
        node.methods.byMethod.set(method, key);
        this.routeCount++;
        if (firstKey === null) {
          firstKey = key;
        }
        if (node.kind === NodeKind.Wildcard) {
          this.registerWildcardRoute(method);
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
          node.wildcardChild = acquireRouterNode(NodeKind.Wildcard, name);
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
            node.wildcardChild = acquireRouterNode(NodeKind.Wildcard, name || '*');
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
            node.wildcardChild = acquireRouterNode(NodeKind.Wildcard, name || '*');
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
          child = acquireRouterNode(NodeKind.Param, name);
          if (patternSrc) {
            const normalizedPattern = this.normalizeParamPatternSource(patternSrc);
            this.ensureRegexSafe(normalizedPattern);
            const patternFlags = '';
            const compiledPattern = this.acquireCompiledPattern(normalizedPattern, patternFlags);
            child.pattern = compiledPattern;
            child.patternSource = normalizedPattern;
            child.patternTester = this.acquirePatternTester(normalizedPattern, patternFlags, compiledPattern);
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
      child = acquireRouterNode(NodeKind.Static, seg);
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

  private assertSealed(): void {
    if (!this.sealed) {
      throw new Error('Router has not been finalized. Call build() before matching.');
    }
  }

  private requireBuilderRoot(): RouterNode {
    if (!this.root) {
      throw new Error('Router builder state is no longer available. Instantiate a new builder to add routes.');
    }
    return this.root;
  }

  private releaseBuilderState(): void {
    if (this.root) {
      releaseRouterSubtree(this.root);
      this.root = null;
    }
  }

  private registerWildcardRoute(method: HttpMethod): void {
    this.wildcardRouteCount++;
    const store = (this.wildcardMethodsByMethod ??= Object.create(null));
    store[method as number] = true;
    this.hasWildcardRoutes = true;
  }

  private describeMethod(method: HttpMethod): string {
    const reversed = (HttpMethod as unknown as Record<number, string>)[method as number];
    if (typeof reversed === 'string') {
      return reversed.toUpperCase();
    }
    return String(method);
  }

  /* Regex runtime timeout check removed for performance */
  private buildPatternTesterOptions(): PatternTesterOptions | undefined {
    return undefined;
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
      const message = `Unsafe route regex '${patternSrc}'${reason} `;
      if (safety.mode === 'warn') {
        console.warn(`[bunner / router] ${message} `);
      } else {
        throw new Error(message);
      }
    }
    safety.validator?.(patternSrc);
  }

  private buildWildcardSuffixPlan(prepared: NormalizedPathSegments): SuffixPlan | undefined {
    const segments = prepared.segments;
    const normalizedPath = prepared.normalized;
    if (!segments.length || normalizedPath.length <= 1) {
      return undefined;
    }
    const source = prepared.suffixSource ?? (normalizedPath.charCodeAt(0) === 47 ? normalizedPath.slice(1) : normalizedPath);
    if (!source.length) {
      return undefined;
    }
    if (!prepared.suffixSource) {
      prepared.suffixSource = source;
    }
    const cached = prepared.suffixPlan;
    if (cached && cached.source === source) {
      return cached;
    }
    const offsets = ensureSegmentOffsets(prepared);
    const slices = ensureSuffixSlices(prepared, offsets, source);
    const plan: SuffixPlan = { source, offsets, slices };
    prepared.suffixPlan = plan;
    return plan;
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
      const message = `[bunner / router] Parameter regex '${patternSrc}' declares '^' or '$' anchors.Bunner wraps patterns automatically, so anchors are stripped.`;
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

  private buildLayoutPatternTesters(layout: { patterns: ReadonlyArray<any> }): ReadonlyArray<PatternTesterFn | undefined> {
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
      testers[i] = this.acquirePatternTester(pattern.source, flags);
    }
    return testers;
  }

  private acquirePatternTester(source: string | undefined, flags: string, compiled?: RegExp): PatternTesterFn {
    const key = this.buildPatternCacheKey(source, flags);
    const cached = this.patternTesterCache.get(key);
    if (cached) {
      return cached;
    }
    const regex = compiled ?? (source ? this.acquireCompiledPattern(source, flags) : new RegExp('^.*$', flags));
    const tester = buildPatternTester(source, regex, this.patternTesterOptions);
    this.patternTesterCache.set(key, tester);
    return tester;
  }

  private acquireCompiledPattern(source: string, flags: string): RegExp {
    const key = this.buildPatternCacheKey(source, flags);
    const cached = this.compiledPatternCache.get(key);
    if (cached) {
      return cached;
    }
    const compiled = new RegExp(`^(?:${source})$`, flags);
    this.compiledPatternCache.set(key, compiled);
    return compiled;
  }

  private buildPatternCacheKey(source: string | undefined, flags: string | undefined): string {
    return `${flags ?? ''}| ${source ?? '<anon>'} `;
  }

  /* Parameter-tuning related methods removed for static performance stability */

  private methodHasWildcard(method: HttpMethod): boolean {
    if (!this.wildcardMethodsByMethod) {
      return this.wildcardRouteCount > 0 ? this.hasWildcardRoutes : false;
    }
    return Boolean(this.wildcardMethodsByMethod[method as number]);
  }
}
