import type { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import { hydrateParams } from '../cache/cache-helpers';
import type {
  StaticProbeResult,
  RouteMatch,
  DynamicMatchResult,
  SuffixPlan,
  PipelineStageConfig,
  NormalizedPathSegments,
} from '../types';
import type { PathNormalizer } from '../utils/path-utils';

import { OptionalParamDefaults } from './optional-param-defaults';
import { RouterCache } from './router-cache';
import { StaticFastRegistry } from './static-fast-registry';

type StaticMatchBuilder = (key: RouteKey) => RouteMatch;
type StaticMatcher = (method: HttpMethod, path: string) => StaticProbeResult;
type DynamicFinder = (
  method: HttpMethod,
  prepared: NormalizedPathSegments,
  captureSnapshot: boolean,
  suffixPlanFactory: (() => SuffixPlan | undefined) | undefined,
  methodHasWildcard: boolean,
) => DynamicMatchResult | null;
type WildcardPlanner = (prepared: NormalizedPathSegments) => SuffixPlan | undefined;
type WildcardChecker = (method: HttpMethod) => boolean;

type MatchRunnerDeps = {
  cache: RouterCache;
  staticRegistry: StaticFastRegistry;
  optionalDefaults: OptionalParamDefaults;
  stageConfig: PipelineStageConfig;
  normalizePath: PathNormalizer;
  buildStaticMatch: StaticMatchBuilder;
  tryStaticFast: StaticMatcher;
  findDynamicMatch: DynamicFinder;
  buildWildcardSuffixPlan: WildcardPlanner;
  methodHasWildcard: WildcardChecker;
};

export class MatchRunner {
  private static readonly WILDCARD_PLAN_CACHE_LIMIT = 256;
  private readonly execute: (method: HttpMethod, path: string) => RouteMatch | null;
  private wildcardPlanCache?: Map<number, Map<string, SuffixPlan | null>>;
  private wildcardPlanOrder?: Array<{ method: number; normalized: string }>;
  private wildcardPlanEvictIndex = 0;

  constructor(private readonly deps: MatchRunnerDeps) {
    this.execute = this.buildPipeline();
  }

  run(method: HttpMethod, path: string): RouteMatch | null {
    return this.execute(method, path);
  }

  private resolveSuffixPlan(
    method: HttpMethod,
    prepared: NormalizedPathSegments,
    planner: WildcardPlanner,
  ): SuffixPlan | undefined {
    if (prepared.suffixPlan) {
      return prepared.suffixPlan;
    }
    const normalized = prepared.normalized;
    if (!normalized) {
      const plan = planner(prepared);
      if (plan) {
        prepared.suffixPlan = plan;
      }
      return plan ?? undefined;
    }
    const methodKey = this.getMethodKey(method);
    const cache = this.getMethodPlanCache(methodKey);
    const cached = cache.get(normalized);
    if (cached !== undefined) {
      return cached === null ? undefined : cached;
    }
    const plan = planner(prepared);
    cache.set(normalized, plan ?? null);
    this.trackPlanEntry(methodKey, normalized);
    if (plan) {
      prepared.suffixPlan = plan;
    }
    return plan ?? undefined;
  }

  private getMethodPlanCache(methodKey: number): Map<string, SuffixPlan | null> {
    const stores = (this.wildcardPlanCache ??= new Map());
    let cache = stores.get(methodKey);
    if (!cache) {
      cache = new Map();
      stores.set(methodKey, cache);
    }
    return cache;
  }

  private trackPlanEntry(methodKey: number, normalized: string): void {
    const order = (this.wildcardPlanOrder ??= []);
    order.push({ method: methodKey, normalized });
    if (order.length - this.wildcardPlanEvictIndex > MatchRunner.WILDCARD_PLAN_CACHE_LIMIT) {
      this.evictOldestPlan();
    }
  }

  private evictOldestPlan(): void {
    const order = this.wildcardPlanOrder;
    if (!order || this.wildcardPlanEvictIndex >= order.length) {
      return;
    }
    const oldest = order[this.wildcardPlanEvictIndex++]!;
    const methodCache = this.wildcardPlanCache?.get(oldest.method);
    methodCache?.delete(oldest.normalized);
    if (methodCache && methodCache.size === 0) {
      this.wildcardPlanCache?.delete(oldest.method);
    }
    if (
      order.length > MatchRunner.WILDCARD_PLAN_CACHE_LIMIT * 2 &&
      this.wildcardPlanEvictIndex >= MatchRunner.WILDCARD_PLAN_CACHE_LIMIT
    ) {
      order.splice(0, this.wildcardPlanEvictIndex);
      this.wildcardPlanEvictIndex = 0;
    }
  }

  private getMethodKey(method: HttpMethod): number {
    return typeof method === 'number' ? method : (method as unknown as number);
  }

  private buildPipeline(): (method: HttpMethod, path: string) => RouteMatch | null {
    const {
      cache,
      staticRegistry,
      optionalDefaults,
      stageConfig,
      buildStaticMatch,
      tryStaticFast,
      findDynamicMatch,
      buildWildcardSuffixPlan,
      methodHasWildcard,
      normalizePath,
    } = this.deps;

    const staticFastEnabled = stageConfig?.match?.['static-fast'] !== false;
    const cacheEnabled = Boolean(cache.isEnabled() && stageConfig?.match?.cache !== false);
    const dynamicEnabled = stageConfig?.match?.dynamic !== false;

    const readCache = (cacheKey: string): RouteMatch | null | undefined => {
      const record = cache.get(cacheKey);
      if (!record) {
        return undefined;
      }
      if (cache.isStale(record)) {
        cache.delete(cacheKey);
        return undefined;
      }
      cache.touch(cacheKey, record);
      if (record.entry === null) {
        return null;
      }
      const params = hydrateParams(record.entry.params);
      optionalDefaults.apply(record.entry.key, params);
      return { key: record.entry.key, params, meta: { source: 'cache' } };
    };

    if (!staticFastEnabled && !cacheEnabled && !dynamicEnabled) {
      return () => null;
    }

    if (staticFastEnabled) {
      if (cacheEnabled) {
        if (dynamicEnabled) {
          return (method, path) => {
            let preparedRef: NormalizedPathSegments | undefined;
            let normalizedRef: string | undefined;

            const ensurePrepared = (): NormalizedPathSegments => {
              if (!preparedRef) {
                preparedRef = normalizePath(path);
                normalizedRef = preparedRef.normalized;
              } else if (!normalizedRef) {
                normalizedRef = preparedRef.normalized;
              }
              return preparedRef;
            };

            const usePrepared = (candidate?: NormalizedPathSegments): NormalizedPathSegments => {
              if (candidate) {
                preparedRef = candidate;
                normalizedRef = candidate.normalized;
                return candidate;
              }
              return ensurePrepared();
            };

            const ensureNormalized = (): string => {
              if (normalizedRef) {
                return normalizedRef;
              }
              return ensurePrepared().normalized;
            };

            const probe = tryStaticFast(method, path);
            if (probe.kind === 'hit') {
              return probe.match;
            }
            if (probe.kind === 'static-miss') {
              cache.cacheNullMiss(method, probe.normalized);
              return null;
            }
            const prepared = usePrepared(probe.prepared);
            const fastHit = staticRegistry.matchNormalized(method, prepared.normalized, key => buildStaticMatch(key));
            if (fastHit) {
              return fastHit;
            }

            const normalized = ensureNormalized();
            const cacheKey = cache.getKey(method, normalized);
            const cached = readCache(cacheKey);
            if (cached !== undefined) {
              if (cached === null) {
                return null;
              }
              return cached;
            }

            const hasWildcard = methodHasWildcard(method);
            const suffixPlanFactory = hasWildcard
              ? () => this.resolveSuffixPlan(method, prepared, buildWildcardSuffixPlan)
              : undefined;
            const dynamicMatch = findDynamicMatch(method, prepared, true, suffixPlanFactory, hasWildcard);
            if (!dynamicMatch) {
              cache.cacheNullMiss(method, normalized, cacheKey);
              return null;
            }
            const insertedDefaults = optionalDefaults.apply(dynamicMatch.key, dynamicMatch.params);
            if (insertedDefaults && dynamicMatch.snapshot) {
              dynamicMatch.snapshot.push(...insertedDefaults);
            }
            const resolved: RouteMatch = { key: dynamicMatch.key, params: dynamicMatch.params };
            cache.set(cacheKey, resolved, dynamicMatch.snapshot);
            return resolved;
          };
        }

        return (method, path) => {
          let preparedRef: NormalizedPathSegments | undefined;
          let normalizedRef: string | undefined;

          const ensurePrepared = (): NormalizedPathSegments => {
            if (!preparedRef) {
              preparedRef = normalizePath(path);
              normalizedRef = preparedRef.normalized;
            } else if (!normalizedRef) {
              normalizedRef = preparedRef.normalized;
            }
            return preparedRef;
          };

          const usePrepared = (candidate?: NormalizedPathSegments): NormalizedPathSegments => {
            if (candidate) {
              preparedRef = candidate;
              normalizedRef = candidate.normalized;
              return candidate;
            }
            return ensurePrepared();
          };

          const ensureNormalized = (): string => {
            if (normalizedRef) {
              return normalizedRef;
            }
            return ensurePrepared().normalized;
          };

          const probe = tryStaticFast(method, path);
          if (probe.kind === 'hit') {
            return probe.match;
          }
          if (probe.kind === 'static-miss') {
            cache.cacheNullMiss(method, probe.normalized);
            return null;
          }
          const prepared = usePrepared(probe.prepared);
          const fastHit = staticRegistry.matchNormalized(method, prepared.normalized, key => buildStaticMatch(key));
          if (fastHit) {
            return fastHit;
          }

          const normalized = ensureNormalized();
          const cacheKey = cache.getKey(method, normalized);
          const cached = readCache(cacheKey);
          if (cached !== undefined) {
            if (cached === null) {
              return null;
            }
            return cached;
          }

          cache.cacheNullMiss(method, normalized, cacheKey);
          return null;
        };
      }

      if (dynamicEnabled) {
        return (method, path) => {
          let preparedRef: NormalizedPathSegments | undefined;
          let normalizedRef: string | undefined;

          const ensurePrepared = (): NormalizedPathSegments => {
            if (!preparedRef) {
              preparedRef = normalizePath(path);
              normalizedRef = preparedRef.normalized;
            } else if (!normalizedRef) {
              normalizedRef = preparedRef.normalized;
            }
            return preparedRef;
          };

          const usePrepared = (candidate?: NormalizedPathSegments): NormalizedPathSegments => {
            if (candidate) {
              preparedRef = candidate;
              normalizedRef = candidate.normalized;
              return candidate;
            }
            return ensurePrepared();
          };

          const probe = tryStaticFast(method, path);
          if (probe.kind === 'hit') {
            return probe.match;
          }
          if (probe.kind === 'static-miss') {
            return null;
          }
          const prepared = usePrepared(probe.prepared);
          const fastHit = staticRegistry.matchNormalized(method, prepared.normalized, key => buildStaticMatch(key));
          if (fastHit) {
            return fastHit;
          }

          const hasWildcard = methodHasWildcard(method);
          const suffixPlanFactory = hasWildcard
            ? () => this.resolveSuffixPlan(method, prepared, buildWildcardSuffixPlan)
            : undefined;
          const dynamicMatch = findDynamicMatch(method, prepared, false, suffixPlanFactory, hasWildcard);
          if (!dynamicMatch) {
            return null;
          }
          const insertedDefaults = optionalDefaults.apply(dynamicMatch.key, dynamicMatch.params);
          if (insertedDefaults && dynamicMatch.snapshot) {
            dynamicMatch.snapshot.push(...insertedDefaults);
          }
          return { key: dynamicMatch.key, params: dynamicMatch.params };
        };
      }

      return (method, path) => {
        const probe = tryStaticFast(method, path);
        if (probe.kind === 'hit') {
          return probe.match;
        }
        if (probe.kind === 'static-miss') {
          return null;
        }
        const normalized = probe.prepared ? probe.prepared.normalized : normalizePath(path).normalized;
        const fastHit = staticRegistry.matchNormalized(method, normalized, key => buildStaticMatch(key));
        if (fastHit) {
          return fastHit;
        }
        return null;
      };
    }

    if (cacheEnabled) {
      if (dynamicEnabled) {
        return (method, path) => {
          let preparedRef: NormalizedPathSegments | undefined;
          let normalizedRef: string | undefined;

          const ensurePrepared = (): NormalizedPathSegments => {
            if (!preparedRef) {
              preparedRef = normalizePath(path);
              normalizedRef = preparedRef.normalized;
            } else if (!normalizedRef) {
              normalizedRef = preparedRef.normalized;
            }
            return preparedRef;
          };

          const ensureNormalized = (): string => {
            if (normalizedRef) {
              return normalizedRef;
            }
            return ensurePrepared().normalized;
          };

          const prepared = ensurePrepared();
          const normalized = ensureNormalized();
          const cacheKey = cache.getKey(method, normalized);
          const cached = readCache(cacheKey);
          if (cached !== undefined) {
            if (cached === null) {
              return null;
            }
            return cached;
          }

          const hasWildcard = methodHasWildcard(method);
          const suffixPlanFactory = hasWildcard
            ? () => this.resolveSuffixPlan(method, prepared, buildWildcardSuffixPlan)
            : undefined;
          const dynamicMatch = findDynamicMatch(method, prepared, true, suffixPlanFactory, hasWildcard);
          if (!dynamicMatch) {
            cache.cacheNullMiss(method, normalized, cacheKey);
            return null;
          }
          const insertedDefaults = optionalDefaults.apply(dynamicMatch.key, dynamicMatch.params);
          if (insertedDefaults && dynamicMatch.snapshot) {
            dynamicMatch.snapshot.push(...insertedDefaults);
          }
          const resolved: RouteMatch = { key: dynamicMatch.key, params: dynamicMatch.params };
          cache.set(cacheKey, resolved, dynamicMatch.snapshot);
          return resolved;
        };
      }

      return (method, path) => {
        let normalizedRef: string | undefined;
        const ensureNormalized = (): string => {
          if (normalizedRef) {
            return normalizedRef;
          }
          normalizedRef = normalizePath(path).normalized;
          return normalizedRef;
        };

        const normalized = ensureNormalized();
        const cacheKey = cache.getKey(method, normalized);
        const cached = readCache(cacheKey);
        if (cached !== undefined) {
          if (cached === null) {
            return null;
          }
          return cached;
        }
        cache.cacheNullMiss(method, normalized, cacheKey);
        return null;
      };
    }

    // dynamic-only
    return (method, path) => {
      const prepared = normalizePath(path);
      const hasWildcard = methodHasWildcard(method);
      const suffixPlanFactory = hasWildcard ? () => this.resolveSuffixPlan(method, prepared, buildWildcardSuffixPlan) : undefined;
      const dynamicMatch = findDynamicMatch(method, prepared, false, suffixPlanFactory, hasWildcard);
      if (!dynamicMatch) {
        return null;
      }
      const insertedDefaults = optionalDefaults.apply(dynamicMatch.key, dynamicMatch.params);
      if (insertedDefaults && dynamicMatch.snapshot) {
        dynamicMatch.snapshot.push(...insertedDefaults);
      }
      return { key: dynamicMatch.key, params: dynamicMatch.params };
    };
  }
}
