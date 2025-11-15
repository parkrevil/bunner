import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'bun:test';

import { HttpMethod } from '../../../src/enums';
import { RadixRouter } from '../../../src/router/router';
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
  let router: RadixRouter;

  beforeEach(() => {
    router = new RadixRouter();
  });

  afterEach(() => {
    router = undefined as unknown as RadixRouter;
  });

  it('should match a static route for the registered method', () => {
    const key = router.add(HttpMethod.Get, '/users') as RouteKey;
    const match = router.match(HttpMethod.Get, '/users');

    expect(match).toEqual({ key, params: {} });
  });

  it('should reject requests registered for another method', () => {
    router.add(HttpMethod.Post, '/users');

    expect(router.match(HttpMethod.Get, '/users')).toBeNull();
  });

  it('should support registering the root path', () => {
    const key = router.add(HttpMethod.Get, '/') as RouteKey;

    expect(router.match(HttpMethod.Get, '/')).toEqual({ key, params: {} });
  });

  it('should normalize paths that omit the leading slash', () => {
    const key = router.add(HttpMethod.Get, 'settings') as RouteKey;

    expect(router.match(HttpMethod.Get, '/settings')?.key).toBe(key);
  });

  describe('addAll()', () => {
    let keys: RouteKey[];

    beforeEach(() => {
      router = new RadixRouter();
      keys = router.addAll([
        [HttpMethod.Get, '/health'],
        [HttpMethod.Post, '/health'],
      ]);
    });

    it('should register the first tuple as GET', () => {
      expect(router.match(HttpMethod.Get, '/health')?.key).toBe(keys[0]);
    });

    it('should register the second tuple as POST', () => {
      expect(router.match(HttpMethod.Post, '/health')?.key).toBe(keys[1]);
    });
  });

  describe('method array registration', () => {
    let keys: RouteKey[];

    beforeEach(() => {
      router = new RadixRouter();
      keys = router.add([HttpMethod.Get, HttpMethod.Delete], '/bulk') as RouteKey[];
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
        const wildcardRouter = new RadixRouter();
        wildcardRouter.add('*', '/wildcard');

        expect(wildcardRouter.match(method, '/wildcard')).not.toBeNull();
      });
    }
  });

  it('should cache pure static routes in the fast-path table', () => {
    const key = router.add(HttpMethod.Get, '/fast/path') as RouteKey;
    const internal = router as unknown as { staticFast: Map<string, Map<HttpMethod, RouteKey>> };

    expect(internal.staticFast.get('/fast/path')?.get(HttpMethod.Get)).toBe(key);
  });
});
