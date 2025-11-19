import type { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import type { NormalizedPathSegments, RouteMatch, RouterOptions, StaticProbeResult } from '../types';
import { normalizeAndSplit } from '../utils/path-utils';

import { LengthBitset } from './length-bitset';
import type { NormalizedRouterOptions } from './router-options';
import { STATIC_NORMALIZATION_CACHE_LIMIT } from './router-options';

type BuildStaticMatch = (key: RouteKey) => RouteMatch;

type StaticBucket = Map<HttpMethod, RouteKey>;

export class StaticFastRegistry {
  private readonly buckets: Map<string, StaticBucket> = new Map();
  private readonly lengths = new LengthBitset();
  private normalizationCache?: Map<string, NormalizedPathSegments>;
  private lastCaseFoldInput?: string;
  private lastCaseFoldOutput?: string;
  private dynamicRoutes = false;
  private wildcardRoutes = false;

  constructor(private readonly options: NormalizedRouterOptions) {}

  registerRoute(method: HttpMethod, normalizedPath: string, sourcePath: string, key: RouteKey): void {
    if (this.pathContainsDynamicTokens(sourcePath)) {
      return;
    }
    this.lengths.mark(normalizedPath.length);
    let bucket = this.buckets.get(normalizedPath);
    if (!bucket) {
      bucket = new Map();
      this.buckets.set(normalizedPath, bucket);
    }
    bucket.set(method, key);
    if (!this.options.caseSensitive) {
      this.registerCasePreservingFastPaths(sourcePath, bucket);
    }
  }

  tryMatch(method: HttpMethod, path: string, buildMatch: BuildStaticMatch): StaticProbeResult {
    if (!path.length || path.charCodeAt(0) !== 47) {
      return { kind: 'fallback' };
    }
    if (!this.options.caseSensitive) {
      const literalHit = this.resolveMatch(this.buckets.get(path), method, buildMatch);
      if (literalHit) {
        return { kind: 'hit', match: literalHit };
      }
      if (this.options.ignoreTrailingSlash && path.length > 1 && path.charCodeAt(path.length - 1) === 47) {
        const trimmedLiteral = this.trimTrailingSlashes(path);
        if (trimmedLiteral !== path) {
          const trimmedLiteralHit = this.resolveMatch(this.buckets.get(trimmedLiteral), method, buildMatch);
          if (trimmedLiteralHit) {
            return { kind: 'hit', match: trimmedLiteralHit };
          }
        }
      }
    }

    const normalized = this.ensureCaseNormalized(path);
    if (this.lengths.has(normalized.length)) {
      const direct = this.resolveMatch(this.buckets.get(normalized), method, buildMatch);
      if (direct) {
        return { kind: 'hit', match: direct };
      }
    }

    let trimmed: string | undefined;
    if (this.options.ignoreTrailingSlash && normalized.length > 1) {
      const candidate = this.trimTrailingSlashes(normalized);
      if (candidate !== normalized) {
        trimmed = candidate;
        if (this.lengths.has(candidate.length)) {
          const trimmedHit = this.resolveMatch(this.buckets.get(candidate), method, buildMatch);
          if (trimmedHit) {
            return { kind: 'hit', match: trimmedHit };
          }
        }
      }
    }

    const prepared = this.getNormalizedStaticProbe(path);
    if (prepared) {
      if (this.lengths.has(prepared.normalized.length)) {
        const normalizedHit = this.resolveMatch(this.buckets.get(prepared.normalized), method, buildMatch);
        if (normalizedHit) {
          return { kind: 'hit', match: normalizedHit };
        }
      }
      if (!this.options.caseSensitive) {
        const preserved = this.normalizeLiteralStaticPath(path);
        if (this.lengths.has(preserved.length)) {
          const preservedHit = this.resolveMatch(this.buckets.get(preserved), method, buildMatch);
          if (preservedHit) {
            return { kind: 'hit', match: preservedHit };
          }
        }
      }
    }

    const probeKey = trimmed ?? prepared?.normalized ?? normalized;
    if (!this.hasDynamicRoutes() && !this.hasWildcardRoutes() && this.isSimpleStaticPath(probeKey, !this.options.caseSensitive)) {
      return { kind: 'static-miss', normalized: probeKey };
    }
    return prepared ? { kind: 'fallback', prepared } : { kind: 'fallback' };
  }

  matchNormalized(method: HttpMethod, normalized: string, buildMatch: BuildStaticMatch): RouteMatch | undefined {
    if (!this.lengths.has(normalized.length)) {
      return undefined;
    }
    return this.resolveMatch(this.buckets.get(normalized), method, buildMatch);
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

  private registerCasePreservingFastPaths(sourcePath: string, bucket: StaticBucket): void {
    const canonical = this.normalizeLiteralStaticPath(sourcePath);
    if (!this.buckets.has(canonical)) {
      this.buckets.set(canonical, bucket);
    }
    const lowered = canonical.toLowerCase();
    if (!this.buckets.has(lowered)) {
      this.buckets.set(lowered, bucket);
    }
    if (sourcePath !== canonical && !this.buckets.has(sourcePath)) {
      this.buckets.set(sourcePath, bucket);
    }
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

  private ensureCaseNormalized(path: string): string {
    if (this.options.caseSensitive) {
      return path;
    }
    if (this.lastCaseFoldInput === path && this.lastCaseFoldOutput !== undefined) {
      return this.lastCaseFoldOutput;
    }
    let lowered: string | undefined;
    for (let i = 0; i < path.length; i++) {
      const code = path.charCodeAt(i);
      if (code >= 65 && code <= 90) {
        lowered = path.toLowerCase();
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
    const prepared = normalizeAndSplit(path, this.options);
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
