import { describe, it, expect } from 'bun:test';

import { HttpMethod } from '../../../src/enums';
import { RadixRouterBuilder } from '../../../src/router/router';

const buildRouter = (
  configure: (builder: RadixRouterBuilder) => void,
  options?: ConstructorParameters<typeof RadixRouterBuilder>[0],
) => {
  const builder = new RadixRouterBuilder(options);
  configure(builder);
  return builder.build();
};

describe('RadixRouter :: cache snapshots', () => {
  it('should export and hydrate cache snapshots across router instances', () => {
    const firstRouter = buildRouter(
      builder => {
        builder.add(HttpMethod.Get, '/cache/:id');
      },
      { enableCache: true },
    );

    const hotPath = '/cache/snapshot';
    const firstHit = firstRouter.match(HttpMethod.Get, hotPath);
    expect(firstHit).not.toBeNull();

    const cacheHit = firstRouter.match(HttpMethod.Get, hotPath);
    expect(cacheHit?.meta?.source).toBe('cache');

    const snapshot = firstRouter.exportCacheSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.entries.length).toBeGreaterThan(0);

    const secondRouter = buildRouter(
      builder => {
        builder.add(HttpMethod.Get, '/cache/:id');
      },
      { enableCache: true },
    );

    secondRouter.hydrateCacheSnapshot(snapshot);

    const hydratedHit = secondRouter.match(HttpMethod.Get, hotPath);
    expect(hydratedHit?.meta?.source).toBe('cache');
  });
});
