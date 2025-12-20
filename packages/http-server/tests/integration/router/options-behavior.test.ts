import { describe, it, expect } from 'bun:test';

import { Router } from '../../../src/router/router';
import type { HttpMethod } from '../../../src/types';

describe('Router :: options', () => {
  const buildRouter = (configure: (builder: Router) => void, options?: ConstructorParameters<typeof Router>[0]): Router => {
    const builder = new Router(options);
    configure(builder);
    return builder.build();
  };

  describe('ignoreTrailingSlash', () => {
    it('should ignore trailing slash by default', () => {
      const builder = new Router();
      builder.add('GET', '/foo', () => 'ok');
      const router = builder.build();

      expect(router.match('GET', '/foo/')).not.toBeNull();
      expect(router.match('GET', '/foo')).not.toBeNull();
    });

    it('should treat trailing slashes as distinct when disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/users', () => 'user_route');
        },
        { ignoreTrailingSlash: false },
      );

      expect(router.match('GET', '/users')).toBe('user_route');
      expect(router.match('GET', '/users/')).toBeNull();
    });

    it('should respect false setting', () => {
      const builder = new Router({ ignoreTrailingSlash: false });
      builder.add('GET', '/foo', () => 'ok');
      const router = builder.build();

      expect(router.match('GET', '/foo/')).toBeNull();
      expect(router.match('GET', '/foo')).not.toBeNull();
    });
  });

  describe('collapseSlashes', () => {
    it('should normalize duplicate slashes by default', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/multi/slash/path', () => 'multi_slash');
      });

      expect(router.match('GET', '/multi//slash///path')).toBe('multi_slash');
    });

    it('should keep duplicate slashes when disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/raw//path', () => 'raw_path');
        },
        { collapseSlashes: false, blockTraversal: false },
      );

      expect(router.match('GET', '/raw//path')).toBe('raw_path');
      expect(router.match('GET', '/raw/path')).toBeNull();
    });
  });

  describe('caseSensitive', () => {
    it('should be case sensitive by default', () => {
      const builder = new Router();
      builder.add('GET', '/Foo', () => 'ok');
      const router = builder.build();

      expect(router.match('GET', '/foo')).toBeNull();
      expect(router.match('GET', '/Foo')).not.toBeNull();
    });

    it('should ignore case when disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/Users', () => 'users_route');
        },
        { caseSensitive: false },
      );

      expect(router.match('GET', '/users')).toBe('users_route');
    });
  });

  describe('decodeParams', () => {
    it('should decode percent-encoded values when enabled', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/files/:name', params => ({ params }));
      });

      expect(router.match('GET', '/files/report%20Q1')?.params.name).toBe('report Q1');
    });

    it('should keep raw values when disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/files/:name', params => ({ params }));
        },
        { decodeParams: false },
      );

      expect(router.match('GET', '/files/report%20Q1')?.params.name).toBe('report%20Q1');
    });

    it('should fall back to the raw string on invalid encoding', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/files/:name', params => ({ params }));
      });

      expect(router.match('GET', '/files/report%2G')?.params.name).toBe('report%2G');
    });
  });

  describe('failFastOnBadEncoding', () => {
    it('should throw during match when malformed encoding is detected', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/files/:name', () => 'file_route');
        },
        { failFastOnBadEncoding: true },
      );

      expect(() => router.match('GET', '/files/report%2G')).toThrow(/malformed percent/i);
    });

    it('should reject malformed route registrations when enabled', () => {
      const builder = new Router({ failFastOnBadEncoding: true });
      expect(() => builder.add('GET', '/bad%2G/route', () => 'bad_route')).toThrow(/malformed percent/i);
    });

    it('should continue to tolerate malformed encodings when disabled', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/files/:name', params => ({ params }));
      });

      expect(router.match('GET', '/files/report%2G')?.params.name).toBe('report%2G');
    });
  });

  describe('maxSegmentLength', () => {
    it('should reject registration when a literal segment exceeds the configured limit', () => {
      const builder = new Router({ maxSegmentLength: 16 });
      expect(() => builder.add('GET', `/files/${'a'.repeat(32)}`, () => 'long_segment')).toThrow(/segment length/i);
    });

    it('should throw during match when incoming segments exceed the configured limit', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/files/:name', () => 'file_route');
        },
        { maxSegmentLength: 16 },
      );

      expect(() => router.match('GET', `/files/${'b'.repeat(64)}`)).toThrow(/segment length/i);
    });

    it('should allow longer segments when the limit is raised', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', `/files/${'a'.repeat(9000)}`, () => 'long_segment');
        },
        { maxSegmentLength: 10000 },
      );

      expect(router.match('GET', `/files/${'a'.repeat(9000)}`)).not.toBeNull();
    });
  });

  describe('encodedSlashBehavior', () => {
    it('should preserve encoded slashes when configured', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/files/:name', params => ({ params }));
        },
        { encodedSlashBehavior: 'preserve' },
      );

      const match = router.match('GET', '/files/foo%2Fbar%5Cbaz');
      expect(match?.params.name).toBe('foo%2Fbar%5Cbaz');
    });

    it('should reject encoded slashes when configured', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/files/:name', () => 'file_route');
        },
        { encodedSlashBehavior: 'reject' },
      );

      expect(() => router.match('GET', '/files/foo%2Fbar')).toThrow(/encoded slash/i);
    });
  });

  describe('blockTraversal', () => {
    it('should remove dot segments when enabled', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/safe/path', () => 'safe_path');
        },
        { blockTraversal: true },
      );

      expect(router.match('GET', '/foo/../safe/path')).toBe('safe_path');
    });

    it('should fail to match when dot segments remain and blocking is disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/safe/path', () => 'safe_path');
        },
        { blockTraversal: false },
      );

      expect(router.match('GET', '/foo/../safe/path')).toBeNull();
    });

    it('should treat encoded dot segments as traversal attempts when enabled', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/secure/area', () => 'secure_area');
        },
        { blockTraversal: true },
      );

      expect(router.match('GET', '/tmp/%2e%2e/secure/area')).toBe('secure_area');
      expect(router.match('GET', '/tmp/%2E%2E/secure/area')).toBe('secure_area');
    });

    it('should keep encoded dot segments literal when blocking is disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/secure/area', () => 'secure_area');
        },
        { blockTraversal: false },
      );

      expect(router.match('GET', '/tmp/%2e%2e/secure/area')).toBeNull();
    });
  });

  describe('normalization interplay', () => {
    it('should still normalize trailing slashes when other transforms are disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/literal/path', () => 'literal_path');
        },
        { collapseSlashes: false, blockTraversal: false, ignoreTrailingSlash: true },
      );

      expect(router.match('GET', '/literal/path')).toBe('literal_path');
      expect(router.match('GET', '/literal/path/')).toBe('literal_path');
      expect(router.match('GET', '/literal//path/')).toBeNull();
    });
  });

  describe('optionalParamBehavior', () => {
    it('should set undefined by default', () => {
      const builder = new Router();
      builder.add('GET', '/:a/:b?', params => ({ params }));
      const router = builder.build();

      const match = router.match('GET', '/foo');
      expect(match?.params['b']).toBeUndefined();
      expect(Object.keys(match?.params || {}).includes('b')).toBeTrue();
    });

    it('should omit param when behavior is omit', () => {
      const builder = new Router({ optionalParamBehavior: 'omit' });
      builder.add('GET', '/:a/:b?', params => ({ params }));
      const router = builder.build();

      const match = router.match('GET', '/foo');
      expect(match?.params).not.toHaveProperty('b');
    });
  });

  describe('enableCache & cacheSize', () => {
    const getCacheStore = (router: Router<any>): any => {
      // New Architecture: Access private 'cache' field directly

      return (router as any).cache;
    };
    const hasCacheRecord = (router: Router<any>, key: string): boolean => {
      const cache = getCacheStore(router);
      if (!cache) {
        return false;
      }
      return cache.get(key) !== undefined;
    };
    const formatCacheKey = (method: HttpMethod, path: string): string => {
      // New Architecture Key Format
      return `${method}:${path}`;
    };

    it('should clone params when returning cached hits', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/cache/:id', params => ({ params }));
        },
        { enableCache: true },
      );

      const first = router.match('GET', '/cache/alpha');
      first!.params.id = 'mutated';

      const second = router.match('GET', '/cache/alpha');
      expect(second?.params.id).toBe('alpha');
    });

    it('should expose cache hits via match metadata', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/cache/:id', (params, meta) => ({ params, meta }));
        },
        { enableCache: true },
      );

      const cold = router.match('GET', '/cache/meta');
      expect(cold?.meta?.source).toBe('dynamic');

      const warm = router.match('GET', '/cache/meta');
      expect(warm?.meta?.source).toBe('cache');
    });

    it('should cache null misses as well', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/cache/:id', () => 'cache_route');
        },
        { enableCache: true, cacheSize: 8 },
      );

      expect(router.match('GET', '/cache/beta/extra')).toBeNull();
      expect(router.match('GET', '/cache/beta/extra')).toBeNull();
      expect(router.match('GET', '/cache/beta/extra')).toBeNull();

      const cacheKey = formatCacheKey('GET', '/cache/beta/extra');

      const missRecord = getCacheStore(router)?.get(cacheKey);
      expect(missRecord).toBeNull();
    });

    it('should keep unrelated cached hits warm across different routes', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/users/:id', () => 'h1');
          builder.add('GET', '/reports/:name', () => 'h2');
        },
        { enableCache: true },
      );

      expect(router.match('GET', '/users/alpha')).toBe('h1');
      expect(router.match('GET', '/reports/earnings')).toBe('h2');

      expect(hasCacheRecord(router, formatCacheKey('GET', '/users/alpha'))).toBe(true);
      expect(hasCacheRecord(router, formatCacheKey('GET', '/reports/earnings'))).toBe(true);
    });

    it('should not reuse stale miss entries across builds', () => {
      const missOnly = buildRouter(
        () => {
          /* no routes */
        },
        { enableCache: true },
      );
      expect(missOnly.match('GET', '/users/42')).toBeNull();
      const missRecord = getCacheStore(missOnly)?.get(formatCacheKey('GET', '/users/42'));
      expect(missRecord).toBeNull();

      const routed = buildRouter(
        builder => {
          builder.add('GET', '/users/:id', params => ({ params }));
        },
        { enableCache: true },
      );

      const resolved = routed.match('GET', '/users/42');
      expect(resolved?.params.id).toBe('42');
    });
  });
});
