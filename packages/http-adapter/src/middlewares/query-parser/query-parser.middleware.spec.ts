import { describe, expect, it } from 'bun:test';

import type { BunnerRequest } from '../../bunner-request';
import type { BunnerResponse } from '../../bunner-response';
import { BadRequestError } from '../../errors/errors';

import { QueryParserMiddleware } from './query-parser.middleware';

describe('QueryParserMiddleware', () => {
  /**
   * Helper to create a mock BunnerRequest.
   */
  const createMockRequest = (url: string): BunnerRequest => {
    return {
      url,
      query: {} as Record<string, any>,
    } as unknown as BunnerRequest;
  };
  const mockResponse = {} as BunnerResponse;

  // ============================================
  // 1. Basic Parsing
  // ============================================
  describe('Basic Parsing', () => {
    it('should parse simple query string and assign to req.query', () => {
      const middleware = new QueryParserMiddleware({});
      const req = createMockRequest('http://localhost/path?name=value&age=30');

      middleware.handle(req, mockResponse);
      expect(req.query).toEqual({ name: 'value', age: '30' });
    });
    it('should return empty object if no query string', () => {
      const middleware = new QueryParserMiddleware({});
      const req = createMockRequest('http://localhost/path');

      middleware.handle(req, mockResponse);
      expect(req.query).toEqual({});
    });
    it('should return empty object if query string is empty after ?', () => {
      const middleware = new QueryParserMiddleware({});
      const req = createMockRequest('http://localhost/path?');

      middleware.handle(req, mockResponse);
      expect(req.query).toEqual({});
    });
  });
  // ============================================
  // 3. Option Passthrough
  // ============================================
  describe('Option Passthrough', () => {
    it('should parse nested objects when parseArrays: true', () => {
      const middleware = new QueryParserMiddleware({ parseArrays: true });
      const req = createMockRequest('http://localhost/?user[name]=alice&user[age]=30');

      middleware.handle(req, mockResponse);
      expect(req.query).toEqual({ user: { name: 'alice', age: '30' } });
    });
    it('should respect depth option', () => {
      const middleware = new QueryParserMiddleware({ parseArrays: true, depth: 1 });
      const req = createMockRequest('http://localhost/?a[b][c]=d');

      middleware.handle(req, mockResponse);
      expect(req.query).toEqual({ a: { b: {} } });
    });
    it('should respect parameterLimit option', () => {
      const middleware = new QueryParserMiddleware({ parameterLimit: 2 });
      const req = createMockRequest('http://localhost/?a=1&b=2&c=3&d=4');

      middleware.handle(req, mockResponse);
      expect(req.query).toEqual({ a: '1', b: '2' });
    });
    it('should respect hppMode option', () => {
      const middleware = new QueryParserMiddleware({ hppMode: 'last' });
      const req = createMockRequest('http://localhost/?id=1&id=2&id=3');

      middleware.handle(req, mockResponse);
      expect(req.query).toEqual({ id: '3' });
    });
  });
  // ============================================
  // 4. Strict Mode Error Handling
  // ============================================
  describe('Strict Mode Error Handling', () => {
    it('should throw on unbalanced brackets when strictMode: true', () => {
      const middleware = new QueryParserMiddleware({ strictMode: true });
      const req = createMockRequest('http://localhost/?a[b=1');

      expect(() => middleware.handle(req, mockResponse)).toThrow(BadRequestError);
    });
    it('should throw on mixed scalar and nested keys when strictMode: true', () => {
      const middleware = new QueryParserMiddleware({ strictMode: true, parseArrays: true });
      const req = createMockRequest('http://localhost/?a=1&a[b]=2');

      expect(() => middleware.handle(req, mockResponse)).toThrow(BadRequestError);
    });
    it('should NOT throw on malformed query in non-strict mode', () => {
      const middleware = new QueryParserMiddleware({ strictMode: false });
      const req = createMockRequest('http://localhost/?a[b=1');

      middleware.handle(req, mockResponse);
      // Should parse as literal key
      expect(req.query).toEqual({ 'a[b': '1' });
    });
  });
  // ============================================
  // 5. Security (Prototype Pollution)
  // ============================================
  describe('Security', () => {
    it('should block __proto__ pollution through middleware', () => {
      const middleware = new QueryParserMiddleware({ parseArrays: true });
      const req = createMockRequest('http://localhost/?__proto__[polluted]=true');

      middleware.handle(req, mockResponse);
      expect((req.query as any).__proto__?.polluted).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
    });
    it('should block constructor pollution through middleware', () => {
      const middleware = new QueryParserMiddleware({ parseArrays: true });
      const req = createMockRequest('http://localhost/?constructor[prototype][foo]=bar');

      middleware.handle(req, mockResponse);
      expect(Object.prototype.hasOwnProperty.call(req.query, 'constructor')).toBe(false);
    });
  });
  // ============================================
  // 6. Encoding
  // ============================================
  describe('Encoding', () => {
    it('should decode percent-encoded keys and values', () => {
      const middleware = new QueryParserMiddleware({});
      const req = createMockRequest('http://localhost/?%ED%95%9C%EA%B8%80=%ED%85%8C%EC%8A%A4%ED%8A%B8');

      middleware.handle(req, mockResponse);
      expect(req.query).toEqual({ 한글: '테스트' });
    });
    it('should handle special characters', () => {
      const middleware = new QueryParserMiddleware({});
      const req = createMockRequest('http://localhost/?eq=%3D&amp=%26');

      middleware.handle(req, mockResponse);
      expect(req.query).toEqual({ eq: '=', amp: '&' });
    });
  });
});
