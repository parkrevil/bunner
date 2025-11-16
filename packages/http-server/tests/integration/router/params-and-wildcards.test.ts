import { describe, it, expect } from 'bun:test';

import { HttpMethod } from '../../../src/enums';
import { RadixRouter } from '../../../src/router/router';
import type { RouteKey } from '../../../src/types';

describe('RadixRouter :: params and wildcards', () => {
  describe('optional parameters', () => {
    it('should match the base route even without a value', () => {
      const router = new RadixRouter();
      const key = router.add(HttpMethod.Get, '/users/:id?') as RouteKey;

      expect(router.match(HttpMethod.Get, '/users')).toEqual({ key, params: {} });
    });

    it('should store a provided value in params', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/users/:id?');

      expect(router.match(HttpMethod.Get, '/users/42')?.params.id).toBe('42');
    });
  });

  describe('regex-constrained parameters', () => {
    it('should match when the path satisfies the regex', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/orders/:id{[0-9]+}');

      expect(router.match(HttpMethod.Get, '/orders/123')?.params.id).toBe('123');
    });

    it('should fail when the path violates the regex', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/orders/:id{[0-9]+}');

      expect(router.match(HttpMethod.Get, '/orders/abc')).toBeNull();
    });
  });

  describe('multi-segment parameters', () => {
    it('should capture the remaining segments as a single string', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/files/:rest+');

      expect(router.match(HttpMethod.Get, '/files/a/b/c')?.params.rest).toBe('a/b/c');
    });

    it('should fail when no additional segment is present', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/files/:rest+');

      expect(router.match(HttpMethod.Get, '/files')).toBeNull();
    });
  });

  describe('wildcards', () => {
    it('should return the remainder under "*" when unnamed', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/static/*');

      expect(router.match(HttpMethod.Get, '/static/css/app.css')?.params['*']).toBe('css/app.css');
    });

    it('should store the remainder under the provided wildcard name', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/proxy/*path');

      expect(router.match(HttpMethod.Get, '/proxy/v1/api/users')?.params.path).toBe('v1/api/users');
    });

    it('should capture the entire path when the wildcard sits at the root', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/*');

      expect(router.match(HttpMethod.Get, '/any/path')?.params['*']).toBe('any/path');
    });
  });

  describe('matching priority and decoding', () => {
    it('should prioritize regex-constrained params over generic ones regardless of registration order', () => {
      const router = new RadixRouter();
      const slugKey = router.add(HttpMethod.Get, '/articles/:slug') as RouteKey;
      const numericKey = router.add(HttpMethod.Get, '/articles/:id{[0-9]+}') as RouteKey;

      expect(router.match(HttpMethod.Get, '/articles/42')?.key).toBe(numericKey);
      expect(router.match(HttpMethod.Get, '/articles/hello')?.key).toBe(slugKey);
    });

    it('should evaluate regex constraints against decoded parameter values when decoding is enabled', () => {
      const router = new RadixRouter();
      router.add(HttpMethod.Get, '/files/:name{[^\\u002F]+}');

      expect(router.match(HttpMethod.Get, '/files/foo%2Fbar')).toBeNull();
    });

    it('should allow encoded values to bypass regex checks when decoding is disabled', () => {
      const router = new RadixRouter({ decodeParams: false });
      const key = router.add(HttpMethod.Get, '/files/:name{[^\\u002F]+}') as RouteKey;

      expect(router.match(HttpMethod.Get, '/files/foo%2Fbar')?.key).toBe(key);
    });
  });
});
