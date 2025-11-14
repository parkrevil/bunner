import { describe, it, expect } from 'bun:test';

import { HttpMethod } from '../../../src/enums';
import { RadixRouter } from '../../../src/router/router';
import type { RouteKey } from '../../../src/types';

describe('RadixRouter :: options', () => {
  describe('ignoreTrailingSlash', () => {
    it('should allow trailing slashes by default', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/users');

      expect(router.match(HttpMethod.Get, '/users/')).not.toBeNull();
    });

    it('should treat trailing slashes as distinct when disabled', () => {
      const router = new RadixRouter({ ignoreTrailingSlash: false });
      const key = router.add(HttpMethod.Get, '/users') as RouteKey;

      expect(router.match(HttpMethod.Get, '/users')?.key).toBe(key);
      expect(router.match(HttpMethod.Get, '/users/')).toBeNull();
    });
  });

  describe('collapseSlashes', () => {
    it('should normalize duplicate slashes by default', () => {
      const router = new RadixRouter();
      const key = router.add(HttpMethod.Get, '/multi/slash/path') as RouteKey;

      expect(router.match(HttpMethod.Get, '/multi//slash///path')?.key).toBe(key);
    });

    it('should keep duplicate slashes when disabled', () => {
      const router = new RadixRouter({ collapseSlashes: false, blockTraversal: false });
      const key = router.add(HttpMethod.Get, '/raw//path') as RouteKey;

      expect(router.match(HttpMethod.Get, '/raw//path')?.key).toBe(key);
      expect(router.match(HttpMethod.Get, '/raw/path')).toBeNull();
    });
  });

  describe('caseSensitive', () => {
    it('should distinguish case when enabled', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/Users');

      expect(router.match(HttpMethod.Get, '/users')).toBeNull();
    });

    it('should ignore case when disabled', () => {
      const router = new RadixRouter({ caseSensitive: false });
      const key = router.add(HttpMethod.Get, '/Users') as RouteKey;

      expect(router.match(HttpMethod.Get, '/users')?.key).toBe(key);
    });
  });

  describe('decodeParams', () => {
    it('should decode percent-encoded values when enabled', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/files/:name');

      expect(router.match(HttpMethod.Get, '/files/report%20Q1')?.params.name).toBe('report Q1');
    });

    it('should keep raw values when disabled', () => {
      const router = new RadixRouter({ decodeParams: false });
      router.add(HttpMethod.Get, '/files/:name');

      expect(router.match(HttpMethod.Get, '/files/report%20Q1')?.params.name).toBe('report%20Q1');
    });

    it('should fall back to the raw string on invalid encoding', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/files/:name');

      expect(router.match(HttpMethod.Get, '/files/report%2G')?.params.name).toBe('report%2G');
    });
  });

  describe('blockTraversal', () => {
    it('should remove dot segments when enabled', () => {
      const router = new RadixRouter({ blockTraversal: true });
      const key = router.add(HttpMethod.Get, '/safe/path') as RouteKey;

      expect(router.match(HttpMethod.Get, '/foo/../safe/path')?.key).toBe(key);
    });

    it('should fail to match when dot segments remain and blocking is disabled', () => {
      const router = new RadixRouter({ blockTraversal: false });
      router.add(HttpMethod.Get, '/safe/path');

      expect(router.match(HttpMethod.Get, '/foo/../safe/path')).toBeNull();
    });
  });

  describe('enableCache & cacheSize', () => {
    it('should clone params when returning cached hits', () => {
      const router = new RadixRouter({ enableCache: true });
      router.add(HttpMethod.Get, '/cache/:id');

      const first = router.match(HttpMethod.Get, '/cache/alpha');
      first!.params.id = 'mutated';

      const second = router.match(HttpMethod.Get, '/cache/alpha');
      expect(second?.params.id).toBe('alpha');
    });

    it('should cache null misses as well', () => {
      const router = new RadixRouter({ enableCache: true, cacheSize: 8 });
      router.add(HttpMethod.Get, '/cache/:id');

      expect(router.match(HttpMethod.Get, '/cache/beta/extra')).toBeNull();

      const internal = router as unknown as { cache?: Map<string, unknown> };
      const cacheKey = `${HttpMethod.Get} cache/beta/extra`;
      expect(internal.cache?.get(cacheKey)).toBeNull();
    });

    it('should evict oldest entries when cacheSize is exceeded', () => {
      const router = new RadixRouter({ enableCache: true, cacheSize: 2 });
      router.add(HttpMethod.Get, '/cache/:id');

      router.match(HttpMethod.Get, '/cache/a');
      router.match(HttpMethod.Get, '/cache/b');
      router.match(HttpMethod.Get, '/cache/c');

      const internal = router as unknown as { cache?: Map<string, unknown> };
      const firstKey = `${HttpMethod.Get} cache/a`;
      const secondKey = `${HttpMethod.Get} cache/b`;
      const thirdKey = `${HttpMethod.Get} cache/c`;

      expect(internal.cache?.has(firstKey)).toBe(false);
      expect(internal.cache?.has(secondKey)).toBe(true);
      expect(internal.cache?.has(thirdKey)).toBe(true);
    });
  });
});
