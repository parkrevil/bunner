import { describe, it, expect } from 'bun:test';

import { HttpMethod } from '../../../src/enums';
import type { RouterInstance } from '../../../src/router/interfaces';
import { RadixRouterBuilder } from '../../../src/router/router';
import type { RouteKey } from '../../../src/types';

describe('RadixRouter :: options', () => {
  const buildRouter = (
    configure: (builder: RadixRouterBuilder) => void,
    options?: ConstructorParameters<typeof RadixRouterBuilder>[0],
  ): RouterInstance => {
    const builder = new RadixRouterBuilder(options);
    configure(builder);
    return builder.build();
  };

  describe('ignoreTrailingSlash', () => {
    it('should allow trailing slashes by default', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/users');
      });

      expect(router.match(HttpMethod.Get, '/users/')).not.toBeNull();
    });

    it('should treat trailing slashes as distinct when disabled', () => {
      let key!: RouteKey;
      const router = buildRouter(
        builder => {
          key = builder.add(HttpMethod.Get, '/users') as RouteKey;
        },
        { ignoreTrailingSlash: false },
      );

      expect(router.match(HttpMethod.Get, '/users')?.key).toBe(key);
      expect(router.match(HttpMethod.Get, '/users/')).toBeNull();
    });
  });

  describe('collapseSlashes', () => {
    it('should normalize duplicate slashes by default', () => {
      let key!: RouteKey;
      const router = buildRouter(builder => {
        key = builder.add(HttpMethod.Get, '/multi/slash/path') as RouteKey;
      });

      expect(router.match(HttpMethod.Get, '/multi//slash///path')?.key).toBe(key);
    });

    it('should keep duplicate slashes when disabled', () => {
      let key!: RouteKey;
      const router = buildRouter(
        builder => {
          key = builder.add(HttpMethod.Get, '/raw//path') as RouteKey;
        },
        { collapseSlashes: false, blockTraversal: false },
      );

      expect(router.match(HttpMethod.Get, '/raw//path')?.key).toBe(key);
      expect(router.match(HttpMethod.Get, '/raw/path')).toBeNull();
    });
  });

  describe('caseSensitive', () => {
    it('should distinguish case when enabled', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/Users');
      });

      expect(router.match(HttpMethod.Get, '/users')).toBeNull();
    });

    it('should ignore case when disabled', () => {
      let key!: RouteKey;
      const router = buildRouter(
        builder => {
          key = builder.add(HttpMethod.Get, '/Users') as RouteKey;
        },
        { caseSensitive: false },
      );

      expect(router.match(HttpMethod.Get, '/users')?.key).toBe(key);
    });
  });

  describe('decodeParams', () => {
    it('should decode percent-encoded values when enabled', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/files/:name');
      });

      expect(router.match(HttpMethod.Get, '/files/report%20Q1')?.params.name).toBe('report Q1');
    });

    it('should keep raw values when disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/files/:name');
        },
        { decodeParams: false },
      );

      expect(router.match(HttpMethod.Get, '/files/report%20Q1')?.params.name).toBe('report%20Q1');
    });

    it('should fall back to the raw string on invalid encoding', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/files/:name');
      });

      expect(router.match(HttpMethod.Get, '/files/report%2G')?.params.name).toBe('report%2G');
    });
  });

  describe('encodedSlashBehavior', () => {
    it('should preserve encoded slashes when configured', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/files/:name');
        },
        { encodedSlashBehavior: 'preserve' },
      );

      const match = router.match(HttpMethod.Get, '/files/foo%2Fbar%5Cbaz');
      expect(match?.params.name).toBe('foo%2Fbar%5Cbaz');
    });

    it('should reject encoded slashes when configured', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/files/:name');
        },
        { encodedSlashBehavior: 'reject' },
      );

      expect(() => router.match(HttpMethod.Get, '/files/foo%2Fbar')).toThrow(/encoded slash/i);
    });
  });

  describe('blockTraversal', () => {
    it('should remove dot segments when enabled', () => {
      let key!: RouteKey;
      const router = buildRouter(
        builder => {
          key = builder.add(HttpMethod.Get, '/safe/path') as RouteKey;
        },
        { blockTraversal: true },
      );

      expect(router.match(HttpMethod.Get, '/foo/../safe/path')?.key).toBe(key);
    });

    it('should fail to match when dot segments remain and blocking is disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/safe/path');
        },
        { blockTraversal: false },
      );

      expect(router.match(HttpMethod.Get, '/foo/../safe/path')).toBeNull();
    });

    it('should treat encoded dot segments as traversal attempts when enabled', () => {
      let key!: RouteKey;
      const router = buildRouter(
        builder => {
          key = builder.add(HttpMethod.Get, '/secure/area') as RouteKey;
        },
        { blockTraversal: true },
      );

      expect(router.match(HttpMethod.Get, '/tmp/%2e%2e/secure/area')?.key).toBe(key);
      expect(router.match(HttpMethod.Get, '/tmp/%2E%2E/secure/area')?.key).toBe(key);
    });

    it('should keep encoded dot segments literal when blocking is disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/secure/area');
        },
        { blockTraversal: false },
      );

      expect(router.match(HttpMethod.Get, '/tmp/%2e%2e/secure/area')).toBeNull();
    });
  });

  describe('enableCache & cacheSize', () => {
    const getCache = (router: RouterInstance): Map<string, unknown> | undefined => {
      const internal = router as unknown as { core?: { cache?: Map<string, unknown> } };
      return internal.core?.cache;
    };
    const formatCacheKey = (method: HttpMethod, path: string): string => {
      const normalized = path.startsWith('/') ? path.slice(1) : path;
      return `${method}\u0000${normalized}`;
    };

    it('should clone params when returning cached hits', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/cache/:id');
        },
        { enableCache: true },
      );

      const first = router.match(HttpMethod.Get, '/cache/alpha');
      first!.params.id = 'mutated';

      const second = router.match(HttpMethod.Get, '/cache/alpha');
      expect(second?.params.id).toBe('alpha');
    });

    it('should cache null misses as well', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/cache/:id');
        },
        { enableCache: true, cacheSize: 8 },
      );

      expect(router.match(HttpMethod.Get, '/cache/beta/extra')).toBeNull();

      const cacheKey = formatCacheKey(HttpMethod.Get, '/cache/beta/extra');
      const missRecord = getCache(router)?.get(cacheKey) as { entry?: unknown } | undefined;
      expect(missRecord?.entry).toBeNull();
    });

    it('should evict oldest entries when cacheSize is exceeded', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/cache/:id');
        },
        { enableCache: true, cacheSize: 2 },
      );

      router.match(HttpMethod.Get, '/cache/a');
      router.match(HttpMethod.Get, '/cache/b');
      router.match(HttpMethod.Get, '/cache/c');

      const firstKey = formatCacheKey(HttpMethod.Get, '/cache/a');
      const secondKey = formatCacheKey(HttpMethod.Get, '/cache/b');
      const thirdKey = formatCacheKey(HttpMethod.Get, '/cache/c');

      const cache = getCache(router);
      expect(cache?.has(firstKey)).toBe(false);
      expect(cache?.has(secondKey)).toBe(true);
      expect(cache?.has(thirdKey)).toBe(true);
    });

    it('should keep unrelated cached hits warm across different routes', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/users/:id');
          builder.add(HttpMethod.Get, '/reports/:name');
        },
        { enableCache: true },
      );

      expect(router.match(HttpMethod.Get, '/users/alpha')).not.toBeNull();
      expect(router.match(HttpMethod.Get, '/reports/earnings')).not.toBeNull();

      const cache = getCache(router);
      expect(cache?.has(formatCacheKey(HttpMethod.Get, '/users/alpha'))).toBe(true);
      expect(cache?.has(formatCacheKey(HttpMethod.Get, '/reports/earnings'))).toBe(true);
    });

    it('should not reuse stale miss entries across builds', () => {
      const missOnly = buildRouter(
        () => {
          /* no routes */
        },
        { enableCache: true },
      );
      expect(missOnly.match(HttpMethod.Get, '/users/42')).toBeNull();
      const missCache = getCache(missOnly);
      const missRecord = missCache?.get(formatCacheKey(HttpMethod.Get, '/users/42')) as { entry?: unknown } | undefined;
      expect(missRecord?.entry).toBeNull();

      const routed = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/users/:id');
        },
        { enableCache: true },
      );

      const resolved = routed.match(HttpMethod.Get, '/users/42');
      expect(resolved?.params.id).toBe('42');
    });
  });
});
