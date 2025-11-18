import { describe, it, expect } from 'bun:test';

import { HttpMethod } from '../../../src/enums';
import { RadixRouterBuilder } from '../../../src/router/router';

describe('RadixRouter :: observability hooks', () => {
  it('should emit observer hooks for build/match stages, cache, and static fast hits', () => {
    const stageStarts: Array<{ stage: string }> = [];
    const stageEnds: Array<{ stage: string }> = [];
    const cacheHits: Array<{ key: string }> = [];
    const cacheMisses: Array<{ key: string }> = [];
    const staticHits: Array<{ key: number }> = [];
    const routeMatches: Array<{ fromCache: boolean }> = [];
    const paramBranches: Array<{ nodeIndex: number }> = [];

    const builder = new RadixRouterBuilder({
      enableCache: true,
      observers: {
        onStageStart: event => stageStarts.push({ stage: event.stage }),
        onStageEnd: event => stageEnds.push({ stage: event.stage }),
        onCacheHit: event => cacheHits.push({ key: event.key }),
        onCacheMiss: event => cacheMisses.push({ key: event.key }),
        onStaticFastHit: event => staticHits.push({ key: event.key }),
        onRouteMatch: event => routeMatches.push({ fromCache: event.fromCache }),
        onParamBranchTaken: event => paramBranches.push({ nodeIndex: event.nodeIndex }),
      },
    });

    builder.add(HttpMethod.Get, '/static/path');
    builder.add(HttpMethod.Get, '/users/:id');
    const router = builder.build();

    expect(stageStarts.some(entry => entry.stage.startsWith('build:'))).toBe(true);
    expect(stageEnds.some(entry => entry.stage.startsWith('build:'))).toBe(true);

    router.match(HttpMethod.Get, '/static/path');
    router.match(HttpMethod.Get, '/users/42');
    router.match(HttpMethod.Get, '/users/42');
    router.match(HttpMethod.Get, '/missing');

    expect(staticHits.length).toBeGreaterThan(0);
    expect(cacheHits.length).toBeGreaterThan(0);
    expect(cacheMisses.length).toBeGreaterThan(0);
    expect(routeMatches.some(entry => entry.fromCache === false)).toBe(true);
    expect(routeMatches.some(entry => entry.fromCache === true)).toBe(true);
    expect(paramBranches.length).toBeGreaterThan(0);
    expect(stageStarts.some(entry => entry.stage === 'match:static-fast')).toBe(true);
    expect(stageStarts.some(entry => entry.stage === 'match:cache')).toBe(true);
    expect(stageStarts.some(entry => entry.stage === 'match:dynamic')).toBe(true);
  });

  it('should honor pipeline stage toggles for match stages', () => {
    const stageStarts: string[] = [];
    const routeMatches: Array<{ fromCache: boolean }> = [];

    const builder = new RadixRouterBuilder({
      enableCache: true,
      pipelineStages: {
        match: {
          'static-fast': false,
          cache: false,
          dynamic: true,
        },
      },
      observers: {
        onStageStart: event => stageStarts.push(event.stage),
        onRouteMatch: event => routeMatches.push({ fromCache: event.fromCache }),
      },
    });

    builder.add(HttpMethod.Get, '/posts/:id');
    const router = builder.build();

    router.match(HttpMethod.Get, '/posts/1');
    router.match(HttpMethod.Get, '/posts/1');

    expect(stageStarts.some(stage => stage === 'match:static-fast')).toBe(false);
    expect(stageStarts.some(stage => stage === 'match:cache')).toBe(false);
    expect(stageStarts.some(stage => stage === 'match:dynamic')).toBe(true);
    expect(routeMatches.every(entry => entry.fromCache === false)).toBe(true);
  });
});
