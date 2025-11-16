import { ROUTER_SNAPSHOT_METADATA } from '@bunner/core';

import { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import { hydrateParams } from './cache-helpers';
import { NodeKind } from './enums';
import { buildImmutableLayout, type ImmutableRouterLayout, SerializedNodeRecord } from './immutable-layout';
import type { RouterBuilder, RouterInstance } from './interfaces';
import { DynamicMatcher } from './match-walker';
import { RouterNode } from './node';
import { buildPatternTester, type PatternTesterOptions } from './pattern-tester';
import { assessRegexSafety } from './regex-guard';
import { matchStaticParts, splitStaticChain } from './tree-utils';
import type {
  RegexSafetyOptions,
  DynamicMatchResult,
  MatchObserverHooks,
  PatternTesterFn,
  RouterOptions,
  RouteMatch,
  StaticProbeResult,
  RouterSnapshotMetadata,
  NormalizedPathSegments,
  EncodedSlashBehavior,
} from './types';
import { normalizeAndSplit } from './utils';

type CacheEntry = { key: RouteKey; params?: Array<[string, string]> };
type CacheRecord = { version: number; entry: CacheEntry | null };

let GLOBAL_ROUTE_KEY_SEQ = 1 as RouteKey;

type NormalizedRegexSafetyOptions = {
  mode: 'error' | 'warn';
  maxLength: number;
  forbidBacktrackingTokens: boolean;
  forbidBackreferences: boolean;
  maxExecutionMs?: number;
  validator?: (pattern: string) => void;
};

type NormalizedRouterOptions = Omit<Required<RouterOptions>, 'regexSafety' | 'encodedSlashBehavior'> & {
  regexSafety: NormalizedRegexSafetyOptions;
  encodedSlashBehavior: EncodedSlashBehavior;
};

const DEFAULT_REGEX_SAFETY: NormalizedRegexSafetyOptions = {
  mode: 'error',
  maxLength: 256,
  forbidBacktrackingTokens: true,
  forbidBackreferences: true,
  maxExecutionMs: undefined,
};

const PARAM_RESORT_THRESHOLD = 32;

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

class RadixRouterCore {
  private root: RouterNode | null;
  private options: NormalizedRouterOptions;
  private cache?: Map<string, CacheRecord>;
  private staticFast: Map<string, Map<HttpMethod, RouteKey>> = new Map();
  private patternTesterOptions?: PatternTesterOptions;
  private cacheVersion = 1;
  private lastCacheKeyMethod?: HttpMethod;
  private lastCacheKeyPath?: string;
  private lastCacheKeyValue?: string;
  private wildcardMethodsByMethod: Record<number, true> | null = null;
  private wildcardRouteCount = 0;
  private hasWildcardRoutes = false;
  private hasDynamicRoutes = false;
  private sealed = false;
  private routeCount = 0;
  private layout?: ImmutableRouterLayout;
  private patternTesters: ReadonlyArray<PatternTesterFn | undefined> = [];
  private matchObserver: MatchObserverHooks;
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

  constructor(options?: RouterOptions) {
    const regexSafety = this.normalizeRegexSafety(options?.regexSafety);
    const encodedSlashBehavior: EncodedSlashBehavior =
      options?.encodedSlashBehavior ?? (options?.preserveEncodedSlashes ? 'preserve' : 'decode');
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
      regexSafety,
    };
    this.root = new RouterNode(NodeKind.Static, '');
    this.patternTesterOptions = this.buildPatternTesterOptions();
    this.matchObserver = {
      onParamBranch: (nodeIndex, offset) => this.recordParamUsage(nodeIndex, offset),
    };
    if (this.options.enableCache) {
      this.cache = new Map();
    }
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
    const staticProbe = this.tryStaticFastMatch(method, path);
    if (staticProbe.kind === 'hit') {
      return staticProbe.match;
    }

    if (staticProbe.kind === 'static-miss') {
      this.cacheNullMiss(method, staticProbe.normalized);
      return null;
    }

    const prepared = staticProbe.prepared ?? normalizeAndSplit(path, this.options);
    const normalized = prepared.normalized;

    const directBucket = this.staticFast.get(normalized);
    const fastHit = this.matchStaticEntry(directBucket, method);
    if (fastHit) {
      return fastHit;
    }

    const cacheKey = this.cache ? this.getCacheKey(method, normalized) : undefined;
    if (cacheKey && this.cache) {
      const record = this.cache.get(cacheKey);
      if (record) {
        if (record.version === this.cacheVersion) {
          this.touchCacheEntry(cacheKey, record);
          if (record.entry === null) {
            return null;
          }
          return { key: record.entry.key, params: hydrateParams(record.entry.params) };
        }
        this.cache.delete(cacheKey);
      }
    }

    const captureSnapshot = Boolean(cacheKey && this.cache);
    const methodHasWildcard = this.methodHasWildcard(method);
    const suffixSource = methodHasWildcard && normalized.length > 1 ? normalized.slice(1) : undefined;
    const dynamicMatch = this.findDynamicMatch(method, prepared.segments, captureSnapshot, suffixSource, methodHasWildcard);
    if (!dynamicMatch) {
      this.cacheNullMiss(method, normalized, cacheKey);
      return null;
    }

    const resolved: RouteMatch = { key: dynamicMatch.key, params: dynamicMatch.params };
    if (cacheKey && this.cache) {
      this.setCache(cacheKey, resolved, dynamicMatch.snapshot);
    }
    return resolved;
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
    this.sealed = true;
    this.releaseBuilderState();
  }

  getMetadata(): RouterSnapshotMetadata {
    return this.metadata;
  }

  getLayoutSnapshot(): ImmutableRouterLayout | undefined {
    return this.layout;
  }

  private tryStaticFastMatch(method: HttpMethod, path: string): StaticProbeResult {
    if (!path.length || path.charCodeAt(0) !== 47) {
      return { kind: 'fallback' };
    }
    if (!this.options.caseSensitive) {
      const literalHit = this.matchStaticEntry(this.staticFast.get(path), method);
      if (literalHit) {
        return { kind: 'hit', match: literalHit };
      }
      if (this.options.ignoreTrailingSlash && path.length > 1 && path.charCodeAt(path.length - 1) === 47) {
        const trimmedLiteral = this.trimTrailingSlashes(path);
        if (trimmedLiteral !== path) {
          const trimmedLiteralHit = this.matchStaticEntry(this.staticFast.get(trimmedLiteral), method);
          if (trimmedLiteralHit) {
            return { kind: 'hit', match: trimmedLiteralHit };
          }
        }
      }
    }

    const normalized = this.ensureCaseNormalized(path);
    const direct = this.matchStaticEntry(this.staticFast.get(normalized), method);
    if (direct) {
      return { kind: 'hit', match: direct };
    }

    let trimmed: string | undefined;
    if (this.options.ignoreTrailingSlash && normalized.length > 1) {
      const candidate = this.trimTrailingSlashes(normalized);
      if (candidate !== normalized) {
        trimmed = candidate;
        const trimmedHit = this.matchStaticEntry(this.staticFast.get(candidate), method);
        if (trimmedHit) {
          return { kind: 'hit', match: trimmedHit };
        }
      }
    }

    let prepared: NormalizedPathSegments | undefined;
    if (this.shouldNormalizeStaticProbe(path)) {
      prepared = normalizeAndSplit(path, this.options);
      const normalizedHit = this.matchStaticEntry(this.staticFast.get(prepared.normalized), method);
      if (normalizedHit) {
        return { kind: 'hit', match: normalizedHit };
      }
      if (!this.options.caseSensitive) {
        const preserved = this.normalizeLiteralStaticPath(path);
        const preservedHit = this.matchStaticEntry(this.staticFast.get(preserved), method);
        if (preservedHit) {
          return { kind: 'hit', match: preservedHit };
        }
      }
    }

    const probeKey = trimmed ?? prepared?.normalized ?? normalized;
    if (!this.hasDynamicRoutes && !this.hasWildcardRoutes && this.isSimpleStaticPath(probeKey, !this.options.caseSensitive)) {
      return { kind: 'static-miss', normalized: probeKey };
    }
    return prepared ? { kind: 'fallback', prepared } : { kind: 'fallback' };
  }

  private findDynamicMatch(
    method: HttpMethod,
    segments: string[],
    captureSnapshot: boolean,
    suffixSource: string | undefined,
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
      suffixSource,
      layout: this.layout,
      patternTesters: this.patternTesters,
      paramOrders: this.paramOrders,
      observer: this.matchObserver,
      encodedSlashBehavior: this.options.encodedSlashBehavior,
    });
    return matcher.match();
  }

  private registerStaticFastRoute(method: HttpMethod, normalizedPath: string, sourcePath: string, key: RouteKey): void {
    if (this.pathContainsDynamicTokens(sourcePath)) {
      return;
    }
    let bucket = this.staticFast.get(normalizedPath);
    if (!bucket) {
      bucket = new Map();
      this.staticFast.set(normalizedPath, bucket);
    }
    bucket.set(method, key);
    if (!this.options.caseSensitive) {
      this.registerCasePreservingFastPaths(sourcePath, bucket);
    }
  }

  private registerCasePreservingFastPaths(sourcePath: string, bucket: Map<HttpMethod, RouteKey>): void {
    if (this.options.caseSensitive) {
      return;
    }
    const canonical = this.normalizeLiteralStaticPath(sourcePath);
    if (!this.staticFast.has(canonical)) {
      this.staticFast.set(canonical, bucket);
    }
    if (sourcePath !== canonical && !this.staticFast.has(sourcePath)) {
      this.staticFast.set(sourcePath, bucket);
    }
  }

  private afterRouteInsertion(): void {
    this.bumpCacheVersion();
  }

  private pathContainsDynamicTokens(path: string): boolean {
    return path.indexOf(':') !== -1 || path.indexOf('*') !== -1;
  }

  private normalizeLiteralStaticPath(path: string): string {
    const literalOptions: RouterOptions = {
      ignoreTrailingSlash: this.options.ignoreTrailingSlash,
      collapseSlashes: this.options.collapseSlashes,
      caseSensitive: true,
      blockTraversal: this.options.blockTraversal,
    };
    return normalizeAndSplit(path, literalOptions).normalized;
  }

  private shouldNormalizeStaticProbe(path: string): boolean {
    const collapse = this.options.collapseSlashes !== false;
    const blockTraversal = this.options.blockTraversal !== false;
    for (let i = 1; i < path.length; i++) {
      const code = path.charCodeAt(i);
      if (code !== 47) {
        continue;
      }
      if (collapse && path.charCodeAt(i - 1) === 47) {
        return true;
      }
      if (!blockTraversal) {
        continue;
      }
      const nextIndex = i + 1;
      if (nextIndex >= path.length) {
        continue;
      }
      if (this.segmentIsEncodedDot(path, nextIndex)) {
        return true;
      }
      const next = path.charCodeAt(nextIndex);
      if (next === 46 /* '.' */) {
        if (nextIndex + 1 === path.length || path.charCodeAt(nextIndex + 1) === 47) {
          return true;
        }
        if (nextIndex + 1 < path.length && path.charCodeAt(nextIndex + 1) === 46 /* '.' */) {
          if (nextIndex + 2 === path.length || path.charCodeAt(nextIndex + 2) === 47) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private segmentIsEncodedDot(path: string, start: number): boolean {
    if (path.charCodeAt(start) !== 37 /* '%' */) {
      return false;
    }
    let decodedLen = 0;
    let index = start;
    while (index < path.length) {
      const code = path.charCodeAt(index);
      if (code === 47 /* '/' */) {
        break;
      }
      if (code !== 37 /* '%' */ || index + 2 >= path.length) {
        return false;
      }
      const hi = this.decodeHexDigit(path.charCodeAt(index + 1));
      const lo = this.decodeHexDigit(path.charCodeAt(index + 2));
      if (hi === -1 || lo === -1) {
        return false;
      }
      const byte = (hi << 4) | lo;
      if (byte !== 46 /* '.' */) {
        return false;
      }
      decodedLen++;
      if (decodedLen > 2) {
        return false;
      }
      index += 3;
    }
    return decodedLen === 1 || decodedLen === 2;
  }

  private decodeHexDigit(code: number): number {
    if (code >= 48 && code <= 57) {
      return code - 48;
    }
    if (code >= 65 && code <= 70) {
      return code - 55;
    }
    if (code >= 97 && code <= 102) {
      return code - 87;
    }
    return -1;
  }

  private clearCache(): void {
    this.cache?.clear();
  }

  private cacheNullMiss(method: HttpMethod, normalized: string, existingKey?: string): void {
    if (!this.cache) {
      return;
    }
    const key = existingKey ?? this.getCacheKey(method, normalized);
    this.setCache(key, null);
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
    const addSegments = (node: RouterNode, idx: number, activeParams: Set<string>): void => {
      if (idx === segments.length) {
        const existing = node.methods.byMethod.get(method);
        if (existing !== undefined) {
          throw new Error(`Route already exists for method at path: ${path}`);
        }
        const key = GLOBAL_ROUTE_KEY_SEQ++ as unknown as RouteKey;
        node.methods.byMethod.set(method, key);
        this.routeCount++;
        if (firstKey === null) {
          firstKey = key;
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
          node.wildcardChild = new RouterNode(NodeKind.Wildcard, name);
          node.wildcardChild.wildcardOrigin = 'star';
        }
        const release = registerParamName(name, activeParams);
        try {
          addSegments(node.wildcardChild, idx + 1, activeParams);
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
        if (optional) {
          addSegments(node, idx + 1, activeParams);
        }
        const releaseName = registerParamName(name, activeParams);
        if (multi) {
          if (idx !== segments.length - 1) {
            throw new Error("Multi-segment param ':name+' must be the last segment");
          }
          if (!node.wildcardChild) {
            node.wildcardChild = new RouterNode(NodeKind.Wildcard, name || '*');
            node.wildcardChild.wildcardOrigin = 'multi';
          } else if (node.wildcardChild.wildcardOrigin !== 'multi' || node.wildcardChild.segment !== name) {
            throw new Error(
              `Conflict: multi-parameter ':${name}+' cannot reuse wildcard '${node.wildcardChild.segment}' at '${describeContext(idx)}'`,
            );
          }
          try {
            addSegments(node.wildcardChild, idx + 1, activeParams);
          } finally {
            releaseName();
          }
          return;
        }
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
          addSegments(child, idx + 1, activeParams);
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
            addSegments(child, idx + matched, activeParams);
            return;
          }
        }
        addSegments(child, idx + 1, activeParams);
        return;
      }
      child = new RouterNode(NodeKind.Static, seg);
      node.staticChildren.set(seg, child);
      addSegments(child, idx + 1, activeParams);
    };
    addSegments(this.requireBuilderRoot(), 0, new Set());
    return firstKey!;
  }

  private matchStaticEntry(bucket: Map<HttpMethod, RouteKey> | undefined, method: HttpMethod): RouteMatch | undefined {
    if (!bucket) {
      return undefined;
    }
    const key = bucket.get(method);
    if (key === undefined) {
      return undefined;
    }
    return { key, params: Object.create(null) };
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

  private ensureCaseNormalized(path: string): string {
    if (this.options.caseSensitive) {
      return path;
    }
    for (let i = 0; i < path.length; i++) {
      const code = path.charCodeAt(i);
      if (code >= 65 && code <= 90) {
        return path.toLowerCase();
      }
    }
    return path;
  }

  private trimTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 1 && path.charCodeAt(end - 1) === 47) {
      end--;
    }
    if (end === path.length) {
      return path;
    }
    return end === 1 ? '/' : path.slice(0, end);
  }

  private isSimpleStaticPath(path: string, allowCaseNormalized: boolean = false): boolean {
    if (!path.length || path.charCodeAt(0) !== 47) {
      return false;
    }
    if (!this.options.caseSensitive && !allowCaseNormalized) {
      return false;
    }
    if (this.options.collapseSlashes === false) {
      return false;
    }
    if (this.options.blockTraversal === false) {
      return false;
    }
    let lastSlash = 0;
    for (let i = 1; i < path.length; i++) {
      const code = path.charCodeAt(i);
      if (code !== 47) {
        continue;
      }
      if (i === lastSlash + 1) {
        return false;
      }
      if (this.isDotSegment(path, lastSlash + 1, i)) {
        return false;
      }
      lastSlash = i;
    }
    if (lastSlash < path.length - 1 && this.isDotSegment(path, lastSlash + 1, path.length)) {
      return false;
    }
    return true;
  }

  private isDotSegment(path: string, start: number, end: number): boolean {
    const len = end - start;
    if (len === 1 && path.charCodeAt(start) === 46) {
      return true;
    }
    if (len === 2 && path.charCodeAt(start) === 46 && path.charCodeAt(start + 1) === 46) {
      return true;
    }
    return false;
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

  private compressStaticSubtree(entry: RouterNode): void {
    const stack: RouterNode[] = [entry];
    const seen = new Set<RouterNode>();
    while (stack.length) {
      const current = stack.pop()!;
      if (seen.has(current)) {
        continue;
      }
      seen.add(current);
      for (const child of current.staticChildren.values()) {
        stack.push(child);
        this.collapseStaticNode(child);
      }
    }
  }

  private normalizeRegexSafety(input?: RegexSafetyOptions): NormalizedRegexSafetyOptions {
    return {
      mode: input?.mode ?? DEFAULT_REGEX_SAFETY.mode,
      maxLength: input?.maxLength ?? DEFAULT_REGEX_SAFETY.maxLength,
      forbidBacktrackingTokens: input?.forbidBacktrackingTokens ?? DEFAULT_REGEX_SAFETY.forbidBacktrackingTokens,
      forbidBackreferences: input?.forbidBackreferences ?? DEFAULT_REGEX_SAFETY.forbidBackreferences,
      maxExecutionMs: input?.maxExecutionMs ?? DEFAULT_REGEX_SAFETY.maxExecutionMs,
      validator: input?.validator,
    };
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
      console.warn(
        `[bunner/router] Parameter regex '${patternSrc}' declares '^' or '$' anchors. Bunner wraps patterns automatically, so anchors are stripped.`,
      );
    }
    return normalized;
  }

  private validateRoutePatterns(entry: RouterNode): void {
    const stack: RouterNode[] = [entry];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.patternSource) {
        this.ensureRegexSafe(node.patternSource);
      }
      if (node.wildcardChild) {
        stack.push(node.wildcardChild);
      }
      for (const child of node.paramChildren) {
        stack.push(child);
      }
      for (const child of node.staticChildren.values()) {
        stack.push(child);
      }
    }
  }

  private collapseStaticNode(node: RouterNode): void {
    if (node.kind !== NodeKind.Static) {
      return;
    }
    let cursor = node;
    const parts: string[] = node.segmentParts ? [...node.segmentParts] : [node.segment];
    while (
      cursor.kind === NodeKind.Static &&
      cursor.methods.byMethod.size === 0 &&
      cursor.paramChildren.length === 0 &&
      !cursor.wildcardChild &&
      cursor.staticChildren.size === 1
    ) {
      const next = cursor.staticChildren.values().next().value as RouterNode;
      if (next.kind !== NodeKind.Static) {
        break;
      }
      const nextParts = next.segmentParts ?? [next.segment];
      parts.push(...nextParts);
      cursor = next;
    }
    if (parts.length > 1) {
      node.segment = parts.join('/');
      node.segmentParts = parts;
      node.staticChildren = cursor.staticChildren;
      node.paramChildren = cursor.paramChildren;
      node.wildcardChild = cursor.wildcardChild;
      node.methods = cursor.methods;
    }
  }

  private setCache(key: string, value: RouteMatch | null, paramsEntries?: Array<[string, string]>): void {
    if (!this.cache) {
      return;
    }
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    let record: CacheRecord;
    if (value === null) {
      record = { version: this.cacheVersion, entry: null };
    } else {
      let entries = paramsEntries;
      if (!entries) {
        const paramKeys = Object.keys(value.params);
        if (paramKeys.length) {
          entries = new Array<[string, string]>(paramKeys.length);
          for (let i = 0; i < paramKeys.length; i++) {
            const name = paramKeys[i]!;
            entries[i] = [name, value.params[name]!];
          }
        }
      }
      const snapshot: CacheEntry = entries && entries.length ? { key: value.key, params: entries } : { key: value.key };
      record = { version: this.cacheVersion, entry: snapshot };
    }
    this.cache.set(key, record);
    if (this.cache.size > this.options.cacheSize) {
      const first = this.cache.keys().next().value;
      if (first !== undefined) {
        this.deleteCacheEntry(first);
      }
    }
  }

  private touchCacheEntry(key: string, record: CacheRecord): void {
    if (!this.cache) {
      return;
    }
    this.cache.delete(key);
    this.cache.set(key, record);
  }

  private bumpCacheVersion(): void {
    this.cacheVersion++;
    this.clearCache();
  }

  private getCacheKey(method: HttpMethod, normalized: string): string {
    const normalizedKey = this.toCachePath(normalized);
    if (this.lastCacheKeyMethod === method && this.lastCacheKeyPath === normalizedKey && this.lastCacheKeyValue) {
      return this.lastCacheKeyValue;
    }
    const key = `${method}\u0000${normalizedKey}`;
    this.lastCacheKeyMethod = method;
    this.lastCacheKeyPath = normalizedKey;
    this.lastCacheKeyValue = key;
    return key;
  }

  private runBuildPipeline(root: RouterNode): void {
    const stages: Array<{ name: string; execute: () => void }> = [
      { name: 'compress-static', execute: () => this.compressStaticSubtree(root) },
      { name: 'param-priority', execute: () => this.sortAllParamChildren(root) },
      { name: 'wildcard-suffix', execute: () => this.precomputeWildcardSuffixMetadata(root) },
      { name: 'regex-safety', execute: () => this.validateRoutePatterns(root) },
      { name: 'route-flags', execute: () => this.recalculateRouteFlags(root) },
      { name: 'snapshot-metadata', execute: () => this.updateSnapshotMetadata() },
    ];
    for (const stage of stages) {
      const start = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
      try {
        stage.execute();
      } catch (error) {
        throw new Error(`[bunner/router] Build stage '${stage.name}' failed: ${(error as Error).message}`);
      } finally {
        const end = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
        const duration = (end - start).toFixed(3);
        console.info(`[bunner/router] stage:${stage.name} ${duration}ms`);
      }
    }
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
      this.paramReseedThresholds[i] = PARAM_RESORT_THRESHOLD;
    }
    this.paramOrders = orders;
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
    const threshold = this.paramReseedThresholds[nodeIndex] || PARAM_RESORT_THRESHOLD;
    if (hits < threshold) {
      return;
    }
    if (Math.random() >= 0.5) {
      this.paramReseedThresholds[nodeIndex] = Math.min(threshold << 1, threshold + PARAM_RESORT_THRESHOLD);
      return;
    }
    this.resortParamOrder(nodeIndex, node);
    this.paramReseedThresholds[nodeIndex] = Math.min(threshold << 1, threshold + PARAM_RESORT_THRESHOLD);
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

  private sortAllParamChildren(entry: RouterNode): void {
    const stack: RouterNode[] = [entry];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.paramChildren.length > 1) {
        node.paramChildren.sort((a, b) => this.scoreParamNode(b) - this.scoreParamNode(a));
      }
      for (const child of node.staticChildren.values()) {
        stack.push(child);
      }
      for (const paramChild of node.paramChildren) {
        stack.push(paramChild);
      }
      if (node.wildcardChild) {
        stack.push(node.wildcardChild);
      }
    }
  }

  private scoreParamNode(node: RouterNode): number {
    let score = 0;
    if (node.pattern) {
      score += 2;
    }
    if (node.wildcardChild) {
      score -= 1;
    }
    if (node.methods.byMethod.size) {
      score += 1;
    }
    const len = node.segment.length;
    return score + (len ? 1 / len : 0);
  }

  private recalculateRouteFlags(entry: RouterNode): void {
    let hasWildcard = false;
    let hasDynamic = false;
    const stack: RouterNode[] = [entry];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.paramChildren.length) {
        hasDynamic = true;
      }
      if (node.wildcardChild) {
        hasWildcard = true;
        hasDynamic = true;
        stack.push(node.wildcardChild);
      }
      for (const child of node.paramChildren) {
        stack.push(child);
      }
      for (const child of node.staticChildren.values()) {
        stack.push(child);
      }
    }
    this.hasWildcardRoutes = hasWildcard;
    this.hasDynamicRoutes = hasDynamic;
  }

  private updateSnapshotMetadata(): void {
    const methodsWithWildcard: HttpMethod[] = this.wildcardMethodsByMethod
      ? Object.keys(this.wildcardMethodsByMethod)
          .map(code => Number(code) as HttpMethod)
          .sort((a, b) => a - b)
      : [];
    this.metadata = Object.freeze({
      totalRoutes: this.routeCount,
      hasDynamicRoutes: this.hasDynamicRoutes,
      hasWildcardRoutes: this.hasWildcardRoutes,
      wildcardRouteCount: this.wildcardRouteCount,
      methodsWithWildcard,
      builtAt: Date.now(),
    });
  }

  private precomputeWildcardSuffixMetadata(entry: RouterNode): void {
    const perMethod: Record<number, true> = Object.create(null);
    let wildcardRouteCount = 0;
    const stack: RouterNode[] = [entry];
    while (stack.length) {
      const node = stack.pop()!;
      const wildcard = node.wildcardChild;
      if (wildcard) {
        for (const method of wildcard.methods.byMethod.keys()) {
          perMethod[method as number] = true;
          wildcardRouteCount++;
        }
        stack.push(wildcard);
      }
      for (const child of node.paramChildren) {
        stack.push(child);
      }
      for (const child of node.staticChildren.values()) {
        stack.push(child);
      }
    }
    this.wildcardRouteCount = wildcardRouteCount;
    this.wildcardMethodsByMethod = wildcardRouteCount ? perMethod : null;
  }

  private methodHasWildcard(method: HttpMethod): boolean {
    if (!this.wildcardMethodsByMethod) {
      return this.wildcardRouteCount > 0 ? this.hasWildcardRoutes : false;
    }
    return Boolean(this.wildcardMethodsByMethod[method as number]);
  }

  private toCachePath(normalized: string): string {
    if (normalized.length > 1 && normalized.charCodeAt(0) === 47) {
      return normalized.slice(1);
    }
    return normalized;
  }

  private deleteCacheEntry(key: string): void {
    if (!this.cache || !this.cache.has(key)) {
      return;
    }
    this.cache.delete(key);
  }
}

export class RadixRouterInstance implements RouterInstance {
  constructor(private readonly core: RadixRouterCore) {
    Reflect.defineProperty(this, ROUTER_SNAPSHOT_METADATA, {
      value: core.getMetadata(),
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    return this.core.match(method, path);
  }

  getMetadata(): RouterSnapshotMetadata {
    return this.core.getMetadata();
  }

  getLayoutSnapshot(): ImmutableRouterLayout | undefined {
    return this.core.getLayoutSnapshot();
  }
}

export class RadixRouterBuilder implements RouterBuilder {
  private core: RadixRouterCore | null;

  constructor(options?: RouterOptions) {
    this.core = new RadixRouterCore(options);
  }

  add(method: HttpMethod | HttpMethod[] | '*', path: string): RouteKey | RouteKey[] {
    this.assertActive();
    return this.core!.add(method, path);
  }

  addAll(entries: Array<[HttpMethod, string]>): RouteKey[] {
    this.assertActive();
    return this.core!.addAll(entries);
  }

  build(): RouterInstance {
    this.assertActive();
    const core = this.core!;
    core.finalizeBuild();
    this.core = null;
    return new RadixRouterInstance(core);
  }

  private assertActive(): void {
    if (!this.core) {
      throw new Error('RouterBuilder has already been finalized. Instantiate a new builder for additional routes.');
    }
  }
}

export const RadixRouter = RadixRouterBuilder;
export type RadixRouter = RadixRouterInstance;

export default RadixRouterBuilder;
