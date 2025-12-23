import type { Context } from '@bunner/core';
import { describe, expect, it } from 'bun:test';

import type { HttpContext } from '../../adapter';
import { HTTP_CONTEXT_TYPE } from '../../constants';
import { BadRequestError } from '../../errors/errors';

import { QueryParserMiddleware } from './query-parser.middleware';

describe('QueryParserMiddleware', () => {
  /**
   * Helper to create a mock HttpContext.
   */
  const createMockHttpContext = (url: string): HttpContext => {
    const requestObj = {
      url,
      query: {} as Record<string, any>,
    };

    return {
      getType: () => HTTP_CONTEXT_TYPE,
      get: () => undefined,
      request: requestObj,
      response: {},
    } as unknown as HttpContext;
  };

  /**
   * Helper to create a non-HTTP context (e.g., WebSocket).
   */
  const createNonHttpContext = (): Context => {
    return {
      getType: () => 'ws', // Not HTTP_CONTEXT_TYPE
      get: () => undefined,
    } as unknown as Context;
  };

  // ============================================
  // 1. Basic Parsing
  // ============================================
  describe('Basic Parsing', () => {
    it('should parse simple query string and assign to req.query', () => {
      const middleware = new QueryParserMiddleware({});
      const ctx = createMockHttpContext('http://localhost/path?name=value&age=30');

      middleware.handle(ctx);

      expect(ctx.request.query).toEqual({ name: 'value', age: '30' });
    });

    it('should return empty object if no query string', () => {
      const middleware = new QueryParserMiddleware({});
      const ctx = createMockHttpContext('http://localhost/path');

      middleware.handle(ctx);

      expect(ctx.request.query).toEqual({});
    });

    it('should return empty object if query string is empty after ?', () => {
      const middleware = new QueryParserMiddleware({});
      const ctx = createMockHttpContext('http://localhost/path?');

      middleware.handle(ctx);

      expect(ctx.request.query).toEqual({});
    });
  });

  // ============================================
  // 2. Non-HTTP Context Handling
  // ============================================
  describe('Non-HTTP Context', () => {
    it('should skip processing for non-HTTP contexts', () => {
      const middleware = new QueryParserMiddleware({});
      const ctx = createNonHttpContext();

      const result = middleware.handle(ctx);

      expect(result).toBeUndefined();
      // No error should be thrown, and no query should be set
    });
  });

  // ============================================
  // 3. Option Passthrough
  // ============================================
  describe('Option Passthrough', () => {
    it('should parse nested objects when parseArrays: true', () => {
      const middleware = new QueryParserMiddleware({ parseArrays: true });
      const ctx = createMockHttpContext('http://localhost/?user[name]=alice&user[age]=30');

      middleware.handle(ctx);

      expect(ctx.request.query).toEqual({ user: { name: 'alice', age: '30' } });
    });

    it('should respect depth option', () => {
      const middleware = new QueryParserMiddleware({ parseArrays: true, depth: 1 });
      const ctx = createMockHttpContext('http://localhost/?a[b][c]=d');

      middleware.handle(ctx);

      expect(ctx.request.query).toEqual({ a: { b: {} } });
    });

    it('should respect parameterLimit option', () => {
      const middleware = new QueryParserMiddleware({ parameterLimit: 2 });
      const ctx = createMockHttpContext('http://localhost/?a=1&b=2&c=3&d=4');

      middleware.handle(ctx);

      expect(ctx.request.query).toEqual({ a: '1', b: '2' });
    });

    it('should respect hppMode option', () => {
      const middleware = new QueryParserMiddleware({ hppMode: 'last' });
      const ctx = createMockHttpContext('http://localhost/?id=1&id=2&id=3');

      middleware.handle(ctx);

      expect(ctx.request.query).toEqual({ id: '3' });
    });
  });

  // ============================================
  // 4. Strict Mode Error Handling
  // ============================================
  describe('Strict Mode Error Handling', () => {
    it('should throw on unbalanced brackets when strictMode: true', () => {
      const middleware = new QueryParserMiddleware({ strictMode: true });
      const ctx = createMockHttpContext('http://localhost/?a[b=1');

      expect(() => middleware.handle(ctx)).toThrow(BadRequestError);
    });

    it('should throw on mixed scalar and nested keys when strictMode: true', () => {
      const middleware = new QueryParserMiddleware({ strictMode: true, parseArrays: true });
      const ctx = createMockHttpContext('http://localhost/?a=1&a[b]=2');

      expect(() => middleware.handle(ctx)).toThrow(BadRequestError);
    });

    it('should NOT throw on malformed query in non-strict mode', () => {
      const middleware = new QueryParserMiddleware({ strictMode: false });
      const ctx = createMockHttpContext('http://localhost/?a[b=1');

      middleware.handle(ctx);

      // Should parse as literal key
      expect(ctx.request.query).toEqual({ 'a[b': '1' });
    });
  });

  // ============================================
  // 5. Security (Prototype Pollution)
  // ============================================
  describe('Security', () => {
    it('should block __proto__ pollution through middleware', () => {
      const middleware = new QueryParserMiddleware({ parseArrays: true });
      const ctx = createMockHttpContext('http://localhost/?__proto__[polluted]=true');

      middleware.handle(ctx);

      expect((ctx.request.query as any).__proto__?.polluted).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should block constructor pollution through middleware', () => {
      const middleware = new QueryParserMiddleware({ parseArrays: true });
      const ctx = createMockHttpContext('http://localhost/?constructor[prototype][foo]=bar');

      middleware.handle(ctx);

      expect(Object.prototype.hasOwnProperty.call(ctx.request.query, 'constructor')).toBe(false);
    });
  });

  // ============================================
  // 6. Encoding
  // ============================================
  describe('Encoding', () => {
    it('should decode percent-encoded keys and values', () => {
      const middleware = new QueryParserMiddleware({});
      const ctx = createMockHttpContext('http://localhost/?%ED%95%9C%EA%B8%80=%ED%85%8C%EC%8A%A4%ED%8A%B8');

      middleware.handle(ctx);

      expect(ctx.request.query).toEqual({ 한글: '테스트' });
    });

    it('should handle special characters', () => {
      const middleware = new QueryParserMiddleware({});
      const ctx = createMockHttpContext('http://localhost/?eq=%3D&amp=%26');

      middleware.handle(ctx);

      expect(ctx.request.query).toEqual({ eq: '=', amp: '&' });
    });
  });
});
