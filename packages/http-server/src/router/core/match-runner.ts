import type { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import { hydrateParams } from '../cache/cache-helpers';
import type { StaticProbeResult, RouteMatch, DynamicMatchResult, SuffixPlan, PipelineStageConfig } from '../types';
import { normalizeAndSplit } from '../utils/path-utils';

import { OptionalParamDefaults } from './optional-param-defaults';
import { RouterCache } from './router-cache';
import type { NormalizedRouterOptions } from './router-options';
import { StaticFastRegistry } from './static-fast-registry';

type StaticMatchBuilder = (key: RouteKey) => RouteMatch;
type StaticMatcher = (method: HttpMethod, path: string) => StaticProbeResult;
type DynamicFinder = (
  method: HttpMethod,
  segments: string[],
  captureSnapshot: boolean,
  suffixPlan: SuffixPlan | undefined,
  methodHasWildcard: boolean,
) => DynamicMatchResult | null;
type WildcardPlanner = (segments: string[], normalized: string) => SuffixPlan | undefined;
type WildcardChecker = (method: HttpMethod) => boolean;

type MatchRunnerDeps = {
  options: NormalizedRouterOptions;
  cache: RouterCache;
  staticRegistry: StaticFastRegistry;
  optionalDefaults: OptionalParamDefaults;
  stageConfig: PipelineStageConfig;
  buildStaticMatch: StaticMatchBuilder;
  tryStaticFast: StaticMatcher;
  findDynamicMatch: DynamicFinder;
  buildWildcardSuffixPlan: WildcardPlanner;
  methodHasWildcard: WildcardChecker;
};

export class MatchRunner {
  constructor(private readonly deps: MatchRunnerDeps) {}

  run(method: HttpMethod, path: string): RouteMatch | null {
    const {
      cache,
      staticRegistry,
      optionalDefaults,
      options,
      stageConfig,
      buildStaticMatch,
      tryStaticFast,
      findDynamicMatch,
      buildWildcardSuffixPlan,
      methodHasWildcard,
    } = this.deps;

    const staticFastEnabled = stageConfig?.match?.['static-fast'] !== false;
    const staticProbe = staticFastEnabled ? tryStaticFast(method, path) : ({ kind: 'fallback' } as StaticProbeResult);
    if (staticProbe.kind === 'hit') {
      return staticProbe.match;
    }

    if (staticProbe.kind === 'static-miss') {
      if (cache.isEnabled() && stageConfig?.match?.cache !== false) {
        const missKey = cache.getKey(method, staticProbe.normalized);
        cache.cacheNullMiss(method, staticProbe.normalized, missKey);
      }
      return null;
    }

    const prepared = staticProbe.prepared ?? normalizeAndSplit(path, options);
    const normalized = prepared.normalized;

    const fastHit = staticRegistry.matchNormalized(method, normalized, key => buildStaticMatch(key));
    if (fastHit) {
      return fastHit;
    }

    const cacheEnabled = Boolean(cache.isEnabled() && stageConfig?.match?.cache !== false);
    const cacheKey = cacheEnabled ? cache.getKey(method, normalized) : undefined;
    if (cacheEnabled && cacheKey) {
      const record = cache.get(cacheKey);
      if (record) {
        if (cache.isStale(record)) {
          cache.delete(cacheKey);
        } else {
          cache.touch(cacheKey, record);
          if (record.entry === null) {
            return null;
          }
          const params = hydrateParams(record.entry.params);
          optionalDefaults.apply(record.entry.key, params);
          return { key: record.entry.key, params };
        }
      }
    }

    const captureSnapshot = Boolean(cacheEnabled && cacheKey);
    const hasWildcard = methodHasWildcard(method);
    const suffixPlan = hasWildcard ? buildWildcardSuffixPlan(prepared.segments, normalized) : undefined;

    if (stageConfig?.match?.dynamic === false) {
      if (cacheEnabled && cacheKey) {
        cache.cacheNullMiss(method, normalized, cacheKey);
      }
      return null;
    }

    const dynamicMatch = findDynamicMatch(method, prepared.segments, captureSnapshot, suffixPlan, hasWildcard);
    if (!dynamicMatch) {
      if (cacheEnabled && cacheKey) {
        cache.cacheNullMiss(method, normalized, cacheKey);
      }
      return null;
    }

    const insertedDefaults = optionalDefaults.apply(dynamicMatch.key, dynamicMatch.params);
    if (insertedDefaults && dynamicMatch.snapshot) {
      dynamicMatch.snapshot.push(...insertedDefaults);
    }
    const resolved: RouteMatch = { key: dynamicMatch.key, params: dynamicMatch.params };
    if (cacheEnabled && cacheKey) {
      cache.set(cacheKey, resolved, dynamicMatch.snapshot);
    }
    return resolved;
  }
}
