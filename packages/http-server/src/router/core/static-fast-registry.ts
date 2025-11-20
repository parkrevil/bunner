import type { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import type { NormalizedPathSegments, RouteMatch, StaticProbeResult } from '../types';
import { lowerAsciiSimd, type PathNormalizer } from '../utils/path-utils';

import { LengthBitset } from './length-bitset';
import type { PathBehaviorProfile } from './path-behavior';
import { STATIC_NORMALIZATION_CACHE_LIMIT } from './router-options';

type BuildStaticMatch = (key: RouteKey) => RouteMatch;

type StaticBucket = Map<HttpMethod, RouteKey>;

export class StaticFastRegistry {
  private readonly lengthBuckets: Map<number, Record<string, StaticBucket>> = new Map();
  private readonly lengths = new LengthBitset();
  private normalizationCache?: Map<string, NormalizedPathSegments>;
  private lastCaseFoldInput?: string;
  private lastCaseFoldOutput?: string;
  private lastBucketPath?: string;
  private lastBucketValue?: StaticBucket;
  private lastLengthChecked = -1;
  private lastLengthResult = false;
  private dynamicRoutes = false;
  private wildcardRoutes = false;
  private readonly normalizePath: PathNormalizer;
  private readonly literalNormalizer?: PathNormalizer;
  private readonly requiresNormalization: boolean;
  private readonly needsCaseNormalization: boolean;
  private readonly needsTrailingNormalization: boolean;
  private readonly collapseSlashesEnabled: boolean;
  private readonly blockTraversalEnabled: boolean;
  private readonly caseSensitive: boolean;
  private readonly ignoreTrailingSlash: boolean;

  constructor(behavior: PathBehaviorProfile) {
    this.normalizePath = behavior.normalizePath;
    this.literalNormalizer = behavior.literalNormalizer;
    this.requiresNormalization = behavior.requiresNormalization;
    this.needsCaseNormalization = behavior.needsCaseNormalization;
    this.needsTrailingNormalization = behavior.needsTrailingNormalization;
    this.collapseSlashesEnabled = behavior.collapseSlashesEnabled;
    this.blockTraversalEnabled = behavior.blockTraversalEnabled;
    this.caseSensitive = behavior.caseSensitive;
    this.ignoreTrailingSlash = behavior.ignoreTrailingSlash;
  }

  registerRoute(method: HttpMethod, normalizedPath: string, sourcePath: string, key: RouteKey): void {
    if (this.pathContainsDynamicTokens(sourcePath)) {
      return;
    }
    this.lengths.mark(normalizedPath.length);
    this.lastLengthChecked = -1;
    let bucket = this.getBucket(normalizedPath);
    if (!bucket) {
      bucket = new Map();
      this.setBucket(normalizedPath, bucket);
    }
    bucket.set(method, key);
    if (this.needsCaseNormalization) {
      this.registerCasePreservingFastPaths(sourcePath, bucket);
    }
  }

  tryMatch(method: HttpMethod, path: string, buildMatch: BuildStaticMatch): StaticProbeResult {
    if (!path.length || path.charCodeAt(0) !== 47) {
      return { kind: 'fallback' };
    }
    let normalizedPath: string | undefined;
    let trimmedNormalized: string | undefined;
    let preparedSegments: NormalizedPathSegments | undefined;

    const ensureCaseNormalized = (): string => {
      if (!this.needsCaseNormalization) {
        normalizedPath = path;
        return normalizedPath;
      }
      if (normalizedPath !== undefined) {
        return normalizedPath;
      }
      normalizedPath = this.ensureCaseNormalized(path);
      return normalizedPath;
    };

    const ensureTrimmedNormalized = (): string | undefined => {
      if (!this.needsTrailingNormalization) {
        return undefined;
      }
      if (trimmedNormalized !== undefined) {
        return trimmedNormalized;
      }
      const normalized = ensureCaseNormalized();
      if (normalized.length <= 1) {
        trimmedNormalized = undefined;
        return undefined;
      }
      const candidate = this.trimTrailingSlashes(normalized);
      trimmedNormalized = candidate === normalized ? undefined : candidate;
      return trimmedNormalized;
    };

    const ensurePreparedSegments = (): NormalizedPathSegments => {
      if (preparedSegments) {
        return preparedSegments;
      }
      preparedSegments = this.getNormalizedStaticProbe(path) ?? this.normalizePath(path);
      return preparedSegments;
    };

    if (this.needsCaseNormalization) {
      const literalHit = this.resolveMatch(this.getBucket(path), method, buildMatch);
      if (literalHit) {
        return { kind: 'hit', match: literalHit };
      }
      if (this.needsTrailingNormalization && path.length > 1 && path.charCodeAt(path.length - 1) === 47) {
        const trimmedLiteral = this.trimTrailingSlashes(path);
        if (trimmedLiteral !== path) {
          const trimmedLiteralHit = this.resolveMatch(this.getBucket(trimmedLiteral), method, buildMatch);
          if (trimmedLiteralHit) {
            return { kind: 'hit', match: trimmedLiteralHit };
          }
        }
      }
    }

    const normalized = ensureCaseNormalized();
    if (this.lengthExists(normalized.length)) {
      const direct = this.resolveMatch(this.getBucket(normalized), method, buildMatch);
      if (direct) {
        return { kind: 'hit', match: direct };
      }
    }

    const trimmed = ensureTrimmedNormalized();
    if (trimmed && this.lengthExists(trimmed.length)) {
      const trimmedHit = this.resolveMatch(this.getBucket(trimmed), method, buildMatch);
      if (trimmedHit) {
        return { kind: 'hit', match: trimmedHit };
      }
    }

    const prepared = this.getNormalizedStaticProbe(path);
    if (prepared) {
      if (this.lengthExists(prepared.normalized.length)) {
        const normalizedHit = this.resolveMatch(this.getBucket(prepared.normalized), method, buildMatch);
        if (normalizedHit) {
          return { kind: 'hit', match: normalizedHit };
        }
      }
      if (this.needsCaseNormalization) {
        const preserved = this.normalizeLiteralStaticPath(path);
        if (this.lengthExists(preserved.length)) {
          const preservedHit = this.resolveMatch(this.getBucket(preserved), method, buildMatch);
          if (preservedHit) {
            return { kind: 'hit', match: preservedHit };
          }
        }
      }
      preparedSegments = prepared;
    }

    const probeKey = trimmed ?? normalized ?? ensurePreparedSegments().normalized;
    if (!this.hasDynamicRoutes() && !this.hasWildcardRoutes() && this.isSimpleStaticPath(probeKey, !this.caseSensitive)) {
      return { kind: 'static-miss', normalized: probeKey };
    }
    return { kind: 'fallback', prepared: ensurePreparedSegments() };
  }

  matchNormalized(method: HttpMethod, normalized: string, buildMatch: BuildStaticMatch): RouteMatch | undefined {
    if (!this.lengthExists(normalized.length)) {
      return undefined;
    }
    return this.resolveMatch(this.getBucket(normalized), method, buildMatch);
  }

  markRouteHints(hasDynamicRoutes: boolean, hasWildcardRoutes: boolean): void {
    this.dynamicRoutes = hasDynamicRoutes;
    this.wildcardRoutes = hasWildcardRoutes;
  }

  private hasDynamicRoutes(): boolean {
    return this.dynamicRoutes;
  }

  private hasWildcardRoutes(): boolean {
    return this.wildcardRoutes;
  }

  private resolveMatch(
    bucket: StaticBucket | undefined,
    method: HttpMethod,
    buildMatch: BuildStaticMatch,
  ): RouteMatch | undefined {
    if (!bucket) {
      return undefined;
    }
    const key = bucket.get(method);
    if (key === undefined) {
      return undefined;
    }
    return buildMatch(key);
  }

  private getBucket(path: string): StaticBucket | undefined {
    if (this.lastBucketPath === path) {
      return this.lastBucketValue;
    }
    const table = this.lengthBuckets.get(path.length);
    const bucket = table ? table[path] : undefined;
    this.lastBucketPath = path;
    this.lastBucketValue = bucket;
    return bucket;
  }

  private setBucket(path: string, bucket: StaticBucket): void {
    let table = this.lengthBuckets.get(path.length);
    if (!table) {
      table = Object.create(null) as Record<string, StaticBucket>;
      this.lengthBuckets.set(path.length, table);
    }
    table[path] = bucket;
    this.lastBucketPath = path;
    this.lastBucketValue = bucket;
  }

  private lengthExists(len: number): boolean {
    if (this.lastLengthChecked === len) {
      return this.lastLengthResult;
    }
    const result = this.lengths.has(len);
    this.lastLengthChecked = len;
    this.lastLengthResult = result;
    return result;
  }

  private registerCasePreservingFastPaths(sourcePath: string, bucket: StaticBucket): void {
    const canonical = this.normalizeLiteralStaticPath(sourcePath);
    if (!this.getBucket(canonical)) {
      this.setBucket(canonical, bucket);
    }
    const lowered = lowerAsciiSimd(canonical);
    if (!this.getBucket(lowered)) {
      this.setBucket(lowered, bucket);
    }
    if (sourcePath !== canonical && !this.getBucket(sourcePath)) {
      this.setBucket(sourcePath, bucket);
    }
  }

  private normalizeLiteralStaticPath(path: string): string {
    const literal = this.literalNormalizer;
    if (literal) {
      return literal(path).normalized;
    }
    if (!this.ignoreTrailingSlash) {
      return path;
    }
    return path.length > 1 && path.charCodeAt(path.length - 1) === 47 ? this.trimTrailingSlashes(path) : path;
  }

  private ensureCaseNormalized(path: string): string {
    if (this.caseSensitive) {
      return path;
    }
    if (this.lastCaseFoldInput === path && this.lastCaseFoldOutput !== undefined) {
      return this.lastCaseFoldOutput;
    }
    let lowered: string | undefined;
    for (let i = 0; i < path.length; i++) {
      const code = path.charCodeAt(i);
      if (code >= 65 && code <= 90) {
        lowered = lowerAsciiSimd(path);
        break;
      }
    }
    if (!lowered) {
      this.lastCaseFoldInput = path;
      this.lastCaseFoldOutput = path;
      return path;
    }
    this.lastCaseFoldInput = path;
    this.lastCaseFoldOutput = lowered;
    return lowered;
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
    if (!this.caseSensitive && !allowCaseNormalized) {
      return false;
    }
    if (!this.collapseSlashesEnabled) {
      return false;
    }
    if (!this.blockTraversalEnabled) {
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

  private shouldNormalizeStaticProbe(path: string): boolean {
    if (!this.requiresNormalization) {
      return false;
    }
    const collapse = this.collapseSlashesEnabled;
    const blockTraversal = this.blockTraversalEnabled;
    const needsDotCheck = blockTraversal && path.indexOf('.', 1) !== -1;
    const needsEncodedCheck = blockTraversal && path.indexOf('%', 1) !== -1;
    if (!collapse && !needsDotCheck && !needsEncodedCheck) {
      return false;
    }
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
      if (needsEncodedCheck && this.segmentIsEncodedDot(path, nextIndex)) {
        return true;
      }
      if (!needsDotCheck) {
        continue;
      }
      const next = path.charCodeAt(nextIndex);
      if (next === 46) {
        if (nextIndex + 1 === path.length || path.charCodeAt(nextIndex + 1) === 47) {
          return true;
        }
        if (nextIndex + 1 < path.length && path.charCodeAt(nextIndex + 1) === 46) {
          if (nextIndex + 2 === path.length || path.charCodeAt(nextIndex + 2) === 47) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private segmentIsEncodedDot(path: string, start: number): boolean {
    if (path.charCodeAt(start) !== 37) {
      return false;
    }
    let decodedLen = 0;
    let index = start;
    while (index < path.length) {
      const code = path.charCodeAt(index);
      if (code === 47) {
        break;
      }
      if (code !== 37 || index + 2 >= path.length) {
        return false;
      }
      const hi = this.decodeHexDigit(path.charCodeAt(index + 1));
      const lo = this.decodeHexDigit(path.charCodeAt(index + 2));
      if (hi === -1 || lo === -1) {
        return false;
      }
      const byte = (hi << 4) | lo;
      if (byte !== 46) {
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

  private getNormalizedStaticProbe(path: string): NormalizedPathSegments | undefined {
    if (!this.requiresNormalization) {
      return undefined;
    }
    if (!this.shouldNormalizeStaticProbe(path)) {
      return undefined;
    }
    if (!this.normalizationCache) {
      this.normalizationCache = new Map();
    }
    const cached = this.normalizationCache.get(path);
    if (cached) {
      return cached;
    }
    const prepared = this.normalizePath(path);
    this.normalizationCache.set(path, prepared);
    if (this.normalizationCache.size > STATIC_NORMALIZATION_CACHE_LIMIT) {
      const first = this.normalizationCache.keys().next().value;
      if (first !== undefined) {
        this.normalizationCache.delete(first);
      }
    }
    return prepared;
  }

  private pathContainsDynamicTokens(path: string): boolean {
    return path.indexOf(':') !== -1 || path.indexOf('*') !== -1;
  }
}
