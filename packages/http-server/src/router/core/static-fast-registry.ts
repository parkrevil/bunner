import type { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import type { NormalizedPathSegments, RouteMatch, StaticProbeResult } from '../types';
import { lowerAsciiSimd, type PathNormalizer } from '../utils/path-utils';

import type { PathBehaviorProfile } from './path-behavior';
import { STATIC_NORMALIZATION_CACHE_LIMIT } from './router-options';

type BuildStaticMatch = (key: RouteKey) => RouteMatch;

type LiteralForms = { canonical: string; lowered: string };
const LITERAL_FORMS_CACHE_LIMIT = 512;

export class StaticFastRegistry {
  private readonly routes: Map<string, RouteKey> = new Map();
  // removed: lengthBuckets, lengths, bitsets etc for simplicity and map performance
  private normalizationCache?: Map<string, NormalizedPathSegments>;
  private normalizationCacheLimit = STATIC_NORMALIZATION_CACHE_LIMIT;
  private literalFormsCache?: Map<string, LiteralForms>;
  private lastCaseFoldInput?: string;
  private lastCaseFoldOutput?: string;
  // removed: lastBucketPath, lastBucketValue etc

  private dynamicRoutes = false;
  private wildcardRoutes = false;
  private registeredStaticRoutes = 0;
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
    this.registeredStaticRoutes++;
    this.adjustNormalizationCacheLimit();

    // Store route directly
    const keyStr = this.getCacheKey(method, normalizedPath);
    this.routes.set(keyStr, key);

    if (this.needsCaseNormalization) {
      this.registerCasePreservingFastPaths(method, sourcePath, key);
    }
  }

  tryMatch(method: HttpMethod, path: string, buildMatch: BuildStaticMatch): StaticProbeResult {
    if (!path.length || path.charCodeAt(0) !== 47) {
      return { kind: 'fallback' };
    }

    // Direct lookup
    if (this.needsCaseNormalization) {
      const literalHit = this.lookup(method, path);
      if (literalHit) {
        return { kind: 'hit', match: buildMatch(literalHit) };
      }
      if (this.needsTrailingNormalization && path.length > 1 && path.charCodeAt(path.length - 1) === 47) {
        const trimmedLiteral = this.trimTrailingSlashes(path);
        if (trimmedLiteral !== path) {
          const hit = this.lookup(method, trimmedLiteral);
          if (hit) {
            return { kind: 'hit', match: buildMatch(hit) };
          }
        }
      }
    }

    let normalizedPath = path;
    if (this.needsCaseNormalization) {
      normalizedPath = this.ensureCaseNormalized(path);
    }

    const direct = this.lookup(method, normalizedPath);
    if (direct) {
      return { kind: 'hit', match: buildMatch(direct) };
    }

    let trimmedNormalized: string | undefined;
    if (this.needsTrailingNormalization && normalizedPath.length > 1) {
      const candidate = this.trimTrailingSlashes(normalizedPath);
      if (candidate !== normalizedPath) {
        trimmedNormalized = candidate;
        const hit = this.lookup(method, candidate);
        if (hit) {
          return { kind: 'hit', match: buildMatch(hit) };
        }
      }
    }

    const prepared = this.getNormalizedStaticProbe(path);
    if (prepared) {
      const hit = this.lookup(method, prepared.normalized);
      if (hit) {
        return { kind: 'hit', match: buildMatch(hit) };
      }

      if (this.needsCaseNormalization) {
        const preserved = this.normalizeLiteralStaticPath(path);
        const pHit = this.lookup(method, preserved);
        if (pHit) {
          return { kind: 'hit', match: buildMatch(pHit) };
        }
      }
    }

    const probeKey =
      trimmedNormalized ?? normalizedPath ?? (prepared ? prepared.normalized : this.normalizePath(path).normalized);

    if (!this.hasDynamicRoutes() && !this.hasWildcardRoutes() && this.isSimpleStaticPath(probeKey, !this.caseSensitive)) {
      return { kind: 'static-miss', normalized: probeKey };
    }

    return { kind: 'fallback', prepared: prepared ?? this.normalizePath(path) };
  }

  matchNormalized(method: HttpMethod, normalized: string, buildMatch: BuildStaticMatch): RouteMatch | undefined {
    const key = this.lookup(method, normalized);
    return key ? buildMatch(key) : undefined;
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

  private getCacheKey(method: HttpMethod, path: string): string {
    // Simple composite key
    return method + ':' + path;
  }

  private lookup(method: HttpMethod, path: string): RouteKey | undefined {
    return this.routes.get(this.getCacheKey(method, path));
  }

  private registerCasePreservingFastPaths(method: HttpMethod, sourcePath: string, key: RouteKey): void {
    const { canonical, lowered } = this.getLiteralForms(sourcePath);
    this.routes.set(this.getCacheKey(method, canonical), key);
    this.routes.set(this.getCacheKey(method, lowered), key);
    if (sourcePath !== canonical) {
      this.routes.set(this.getCacheKey(method, sourcePath), key);
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
    if (this.normalizationCache.size > this.normalizationCacheLimit) {
      const first = this.normalizationCache.keys().next().value;
      if (first !== undefined) {
        this.normalizationCache.delete(first);
      }
    }
    return prepared;
  }

  private adjustNormalizationCacheLimit(): void {
    if (this.registeredStaticRoutes <= STATIC_NORMALIZATION_CACHE_LIMIT) {
      this.normalizationCacheLimit = STATIC_NORMALIZATION_CACHE_LIMIT;
      return;
    }
    const scaled = Math.min(4096, Math.max(STATIC_NORMALIZATION_CACHE_LIMIT, Math.ceil(this.registeredStaticRoutes / 8)));
    this.normalizationCacheLimit = scaled;
  }

  private getLiteralForms(sourcePath: string): LiteralForms {
    if (!this.literalFormsCache) {
      this.literalFormsCache = new Map();
    }
    const cached = this.literalFormsCache.get(sourcePath);
    if (cached) {
      return cached;
    }
    const canonical = this.normalizeLiteralStaticPath(sourcePath);
    const lowered = lowerAsciiSimd(canonical);
    const forms: LiteralForms = { canonical, lowered };
    this.literalFormsCache.set(sourcePath, forms);
    if (this.literalFormsCache.size > LITERAL_FORMS_CACHE_LIMIT) {
      const oldest = this.literalFormsCache.keys().next().value;
      if (oldest !== undefined) {
        this.literalFormsCache.delete(oldest);
      }
    }
    return forms;
  }

  private pathContainsDynamicTokens(path: string): boolean {
    return path.indexOf(':') !== -1 || path.indexOf('*') !== -1;
  }
}
