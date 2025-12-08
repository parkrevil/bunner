import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'bun:test';

import { HttpMethod } from '../../../src/enums';
import type { RouterInstance } from '../../../src/router/interfaces';
import { RadixRouterBuilder } from '../../../src/router/router';
import type { RouteKey } from '../../../src/types';

const METHOD_ENTRIES: Array<[string, HttpMethod]> = [];

beforeAll(() => {
  for (const value of Object.values(HttpMethod)) {
    if (typeof value === 'number') {
      METHOD_ENTRIES.push([HttpMethod[value], value]);
    }
  }
});

afterAll(() => {
  METHOD_ENTRIES.length = 0;
});

describe('RadixRouter :: basic routing', () => {
  const buildRouter = (configure: (builder: RadixRouterBuilder) => void): RouterInstance => {
    const builder = new RadixRouterBuilder();
    configure(builder);
    return builder.build();
  };

  it('should match a static route for the registered method', () => {
    let key!: RouteKey;
    const router = buildRouter(builder => {
      key = builder.add(HttpMethod.Get, '/users') as RouteKey;
    });
    const match = router.match(HttpMethod.Get, '/users');

    expect(match).toEqual({ key, params: {} });
  });

  it('should reject requests registered for another method', () => {
    const router = buildRouter(builder => {
      builder.add(HttpMethod.Post, '/users');
    });

    expect(router.match(HttpMethod.Get, '/users')).toBeNull();
  });

  it('should support registering the root path', () => {
    let key!: RouteKey;
    const router = buildRouter(builder => {
      key = builder.add(HttpMethod.Get, '/') as RouteKey;
    });

    expect(router.match(HttpMethod.Get, '/')).toEqual({ key, params: {} });
  });

  it('should normalize paths that omit the leading slash', () => {
    let key!: RouteKey;
    const router = buildRouter(builder => {
      key = builder.add(HttpMethod.Get, 'settings') as RouteKey;
    });

    expect(router.match(HttpMethod.Get, '/settings')?.key).toBe(key);
  });

  describe('addAll()', () => {
    let router: RouterInstance;
    let keys: RouteKey[];

    beforeEach(() => {
      const builder = new RadixRouterBuilder();
      keys = builder.addAll([
        [HttpMethod.Get, '/health'],
        [HttpMethod.Post, '/health'],
      ]);
      router = builder.build();
    });

    it('should register the first tuple as GET', () => {
      expect(router.match(HttpMethod.Get, '/health')?.key).toBe(keys[0]);
    });

    it('should register the second tuple as POST', () => {
      expect(router.match(HttpMethod.Post, '/health')?.key).toBe(keys[1]);
    });
  });

  describe('method array registration', () => {
    let router: RouterInstance;
    let keys: RouteKey[];

    beforeEach(() => {
      const builder = new RadixRouterBuilder();
      keys = builder.add([HttpMethod.Get, HttpMethod.Delete], '/bulk') as RouteKey[];
      router = builder.build();
    });

    it('should handle the first method in the array', () => {
      expect(router.match(HttpMethod.Get, '/bulk')?.key).toBe(keys[0]);
    });

    it('should handle the second method in the array', () => {
      expect(router.match(HttpMethod.Delete, '/bulk')?.key).toBe(keys[1]);
    });
  });

  describe('method wildcard registration', () => {
    for (const [label, method] of METHOD_ENTRIES) {
      it(`should respond to ${label} when registered with '*'`, () => {
        const router = buildRouter(builder => {
          builder.add('*', '/wildcard');
        });

        expect(router.match(method, '/wildcard')).not.toBeNull();
      });
    }
  });

  it('should cache pure static routes in the fast-path table', () => {
    let key!: RouteKey;
    const router = buildRouter(builder => {
      key = builder.add(HttpMethod.Get, '/fast/path') as RouteKey;
    });
    const internal = router as unknown as {
      core?: {
        staticFastRegistry?: {
          matchNormalized: (
            method: HttpMethod,
            normalized: string,
            build: (key: RouteKey) => { key: RouteKey },
          ) => { key: RouteKey } | undefined;
        };
      };
    };
    const registry = internal.core?.staticFastRegistry;
    const fastHit = registry?.matchNormalized(HttpMethod.Get, '/fast/path', storedKey => ({ key: storedKey, params: {} }));

    expect(fastHit?.key).toBe(key);
  });

  it('should normalize redundant slashes and dot segments on the static fast path', () => {
    const builder = new RadixRouterBuilder();
    builder.add(HttpMethod.Get, '/static/assets/logo');
    const router = builder.build();

    expect(router.match(HttpMethod.Get, '//static//./assets/logo/')).not.toBeNull();
  });

  it('should reuse case-insensitive static caches without repeated folding', () => {
    const builder = new RadixRouterBuilder({ caseSensitive: false });
    const key = builder.add(HttpMethod.Get, '/MiXeD/Path') as RouteKey;
    const router = builder.build();

    expect(router.match(HttpMethod.Get, '/mixed/path')).toEqual({ key, params: {} });
    expect(router.match(HttpMethod.Get, '/MIXED/PATH')).toEqual({ key, params: {} });
  });
});
