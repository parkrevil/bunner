import type { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import { hydrateParams } from '../cache/cache-helpers';
import type {
  StaticProbeResult,
  RouteMatch,
  MatchStageName,
  DynamicMatchResult,
  SuffixPlan,
  PipelineStageConfig,
} from '../types';
import { normalizeAndSplit } from '../utils/path-utils';

import { OptionalParamDefaults } from './optional-param-defaults';
import { CACHE_NULL_HIT, RouterCache } from './router-cache';
import type { NormalizedRouterOptions } from './router-options';
import { StaticFastRegistry } from './static-fast-registry';

type StageRunner = <T>(name: MatchStageName, context: Record<string, unknown>, fn: () => T) => T;
type StaticMatchBuilder = (key: RouteKey) => RouteMatch;
type StaticMatcher = (method: HttpMethod, path: string) => StaticProbeResult;
type DynamicFinder = (
  method: HttpMethod,
  segments: string[],
  captureSnapshot: boolean,
  suffixPlan: SuffixPlan | undefined,
  methodHasWildcard: boolean,
) => DynamicMatchResult | null;
type CacheEventEmitter = (kind: 'hit' | 'miss', key: string, method: HttpMethod, path: string) => void;
type StaticFastEmitter = (method: HttpMethod, path: string, key: RouteKey) => void;
type WildcardPlanner = (segments: string[], normalized: string) => SuffixPlan | undefined;
type WildcardChecker = (method: HttpMethod) => boolean;
type MatchRunnerDeps = {
  options: NormalizedRouterOptions;
  cache: RouterCache;
  staticRegistry: StaticFastRegistry;
  optionalDefaults: OptionalParamDefaults;
  stageConfig: PipelineStageConfig;
  runStage: StageRunner;
  buildStaticMatch: StaticMatchBuilder;
  tryStaticFast: StaticMatcher;
  findDynamicMatch: DynamicFinder;
  emitCacheEvent: CacheEventEmitter;
  emitStaticFastHit: StaticFastEmitter;
  buildWildcardSuffixPlan: WildcardPlanner;
  methodHasWildcard: WildcardChecker;
  finalizeMatch?: (method: HttpMethod, path: string, match: RouteMatch, fromCache: boolean) => RouteMatch;
};

export class MatchRunner {
  constructor(private readonly deps: MatchRunnerDeps) {}

  run(method: HttpMethod, path: string, skipCache: boolean, instrument: boolean): RouteMatch | null {
    const {
      cache,
      staticRegistry,
      optionalDefaults,
      options,
      stageConfig,
      runStage,
      buildStaticMatch,
      tryStaticFast,
      findDynamicMatch,
      emitCacheEvent,
      emitStaticFastHit,
      buildWildcardSuffixPlan,
      methodHasWildcard,
    } = this.deps;

    const stageRunner: StageRunner = instrument ? runStage : (_name, _context, fn) => fn();

    const finalize = (match: RouteMatch, fromCache: boolean): RouteMatch =>
      instrument ? (this.deps.finalizeMatch?.(method, path, match, fromCache) ?? match) : match;
    const notifyCache = (kind: 'hit' | 'miss', key?: string): void => {
      if (!instrument || !key) {
        return;
      }
      emitCacheEvent(kind, key, method, path);
    };

    const staticFastEnabled = stageConfig?.match?.['static-fast'] !== false;
    const staticProbe = staticFastEnabled
      ? stageRunner('static-fast', { method, path }, () => tryStaticFast(method, path))
      : ({ kind: 'fallback' } as StaticProbeResult);
    if (staticProbe.kind === 'hit') {
      if (instrument) {
        emitStaticFastHit(method, path, staticProbe.match.key);
      }
      return finalize(staticProbe.match, false);
    }

    if (staticProbe.kind === 'static-miss') {
      if (!skipCache && cache.isEnabled() && stageConfig?.match?.cache !== false) {
        const missKey = cache.getKey(method, staticProbe.normalized);
        cache.cacheNullMiss(method, staticProbe.normalized, missKey);
        notifyCache('miss', missKey);
      }
      return null;
    }

    const prepared = staticProbe.prepared ?? normalizeAndSplit(path, options);
    const normalized = prepared.normalized;

    const fastHit = staticRegistry.matchNormalized(method, normalized, key => buildStaticMatch(key));
    if (fastHit) {
      return finalize(fastHit, false);
    }

    const cacheEnabled = Boolean(!skipCache && cache.isEnabled() && stageConfig?.match?.cache !== false);
    const cacheKey = cacheEnabled ? cache.getKey(method, normalized) : undefined;
    if (cacheEnabled && cacheKey) {
      const cacheContext = { method, path, key: cacheKey };
      const cacheResult = stageRunner('cache', cacheContext, () => {
        const record = cache.get(cacheKey);
        if (!record) {
          notifyCache('miss', cacheKey);
          return null;
        }
        if (cache.isStale(record)) {
          cache.delete(cacheKey);
          notifyCache('miss', cacheKey);
          return null;
        }
        cache.touch(cacheKey, record);
        notifyCache('hit', cacheKey);
        if (record.entry === null) {
          return CACHE_NULL_HIT;
        }
        const params = hydrateParams(record.entry.params);
        optionalDefaults.apply(record.entry.key, params);
        return { key: record.entry.key, params };
      });
      if (cacheResult === CACHE_NULL_HIT) {
        return null;
      }
      if (cacheResult) {
        return finalize(cacheResult, true);
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

    const dynamicContext = { method, path };
    const dynamicMatch = stageRunner('dynamic', dynamicContext, () =>
      findDynamicMatch(method, prepared.segments, captureSnapshot, suffixPlan, hasWildcard),
    );
    if (!dynamicMatch) {
      if (cacheEnabled && cacheKey) {
        cache.cacheNullMiss(method, normalized, cacheKey);
        notifyCache('miss', cacheKey);
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
    return finalize(resolved, false);
  }
}
