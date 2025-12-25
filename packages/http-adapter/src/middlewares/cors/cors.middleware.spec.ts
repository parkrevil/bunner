import { describe, expect, it, mock } from 'bun:test';

import type { HttpContext } from '../../adapter';
import { HTTP_CONTEXT_TYPE } from '../../constants';
import { HeaderField, HttpMethod } from '../../enums';

import { CORS_DEFAULT_METHODS } from './constants';
import { CorsMiddleware } from './cors.middleware';

/**
 * Comprehensive CORS Middleware Test Suite
 *
 * Based on:
 * - Fetch Standard (WHATWG): https://fetch.spec.whatwg.org/#cors-protocol
 * - W3C CORS Specification: https://www.w3.org/TR/cors/
 * - MDN Web Docs: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
 */
describe('CorsMiddleware', () => {
  // ============================================
  // Test Helpers
  // ============================================
  const createMockContext = (method: HttpMethod | string, headers: Record<string, string> = {}): HttpContext => {
    const reqHeaders = new Headers(headers);
    const setStatus = mock();
    const resHeaders = new Headers();

    const setHeaderImpl = (k: string, v: string) => {
      resHeaders.set(k, v);
    };
    const appendHeaderImpl = (k: string, v: string) => {
      resHeaders.append(k, v);
    };

    const requestObj = {
      method,
      headers: reqHeaders,
    };

    const responseObj = {
      setHeader: mock(setHeaderImpl),
      appendHeader: mock(appendHeaderImpl),
      setStatus: setStatus,
      _testHeaders: resHeaders,
    };

    return {
      getType: () => HTTP_CONTEXT_TYPE,
      get: () => undefined,
      request: requestObj,
      response: responseObj,
    } as any;
  };

  const getResHeader = (ctx: any, name: string): string | null => {
    return ctx.response._testHeaders.get(name);
  };

  // ============================================
  // 1. Non-HTTP Context Handling
  // ============================================
  // ============================================
  // 1. Non-HTTP Context Handling - REMOVED (Strict Types enforce HTTP)
  // ============================================

  // ============================================
  // 2. Origin Header Handling (Fetch Standard §3.2.5)
  // ============================================
  describe('Origin Header Handling', () => {
    it('should skip CORS processing if no Origin header is present', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext(HttpMethod.Get);

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
    });

    it('should set Access-Control-Allow-Origin to * by default', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('*');
    });

    it('should NOT set Vary: Origin when using wildcard origin', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.Vary)).toBeNull();
    });

    it('should handle null origin (sandboxed iframe, file://, data: URL)', async () => {
      const middleware = new CorsMiddleware({ origin: true });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'null' });

      await middleware.handle(ctx.request, ctx.response);

      // Reflecting 'null' origin can be a security risk
      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('null');
    });

    it('should block null origin when using strict origin string', async () => {
      const middleware = new CorsMiddleware({ origin: 'https://example.com' });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'null' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
    });
  });

  // ============================================
  // 3. Origin Matching Strategies
  // ============================================
  describe('Origin Matching Strategies', () => {
    describe('Boolean origin', () => {
      it('should reflect origin if configured as true', async () => {
        const middleware = new CorsMiddleware({ origin: true });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://example.com');
        expect(getResHeader(ctx, HeaderField.Vary)).toBe(HeaderField.Origin);
      });

      it('should block all origins if configured as false', async () => {
        const middleware = new CorsMiddleware({ origin: false });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
      });
    });

    describe('String origin', () => {
      it('should match exact string origin', async () => {
        const middleware = new CorsMiddleware({ origin: 'https://allowed.com' });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://allowed.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://allowed.com');
        expect(getResHeader(ctx, HeaderField.Vary)).toBe(HeaderField.Origin);
      });

      it('should reject non-matching string origin', async () => {
        const middleware = new CorsMiddleware({ origin: 'https://allowed.com' });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://forbidden.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
      });

      it('should be case-sensitive for origin matching', async () => {
        const middleware = new CorsMiddleware({ origin: 'https://Example.com' });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
      });

      it('should NOT match partial origin strings', async () => {
        const middleware = new CorsMiddleware({ origin: 'https://example.com' });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com.evil.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
      });
    });

    describe('Regex origin', () => {
      it('should match regex origin pattern', async () => {
        const middleware = new CorsMiddleware({ origin: /\.example\.com$/ });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://sub.example.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://sub.example.com');
      });

      it('should match regex with protocol and port', async () => {
        const middleware = new CorsMiddleware({ origin: /^https:\/\/.*\.example\.com(:\d+)?$/ });

        const ctx1 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://api.example.com' });
        await middleware.handle(ctx1.request, ctx1.response);
        expect(getResHeader(ctx1, HeaderField.AccessControlAllowOrigin)).toBe('https://api.example.com');

        const ctx2 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://api.example.com:8080' });
        await middleware.handle(ctx2.request, ctx2.response);
        expect(getResHeader(ctx2, HeaderField.AccessControlAllowOrigin)).toBe('https://api.example.com:8080');
      });

      it('should reject regex non-match', async () => {
        const middleware = new CorsMiddleware({ origin: /^https:\/\/.*\.example\.com$/ });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'http://sub.example.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
      });
    });

    describe('Array origin', () => {
      it('should match any origin in array', async () => {
        const middleware = new CorsMiddleware({ origin: ['https://a.com', 'https://b.com', /\.c\.com$/] });

        const ctx1 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://a.com' });
        await middleware.handle(ctx1.request, ctx1.response);
        expect(getResHeader(ctx1, HeaderField.AccessControlAllowOrigin)).toBe('https://a.com');

        const ctx2 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://sub.c.com' });
        await middleware.handle(ctx2.request, ctx2.response);
        expect(getResHeader(ctx2, HeaderField.AccessControlAllowOrigin)).toBe('https://sub.c.com');
      });

      it('should reject origin not in array', async () => {
        const middleware = new CorsMiddleware({ origin: ['https://a.com', 'https://b.com'] });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://evil.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
      });

      it('should handle empty origin array', async () => {
        const middleware = new CorsMiddleware({ origin: [] });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://any.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
      });
    });

    describe('Function origin', () => {
      it('should allow origin via async callback', async () => {
        const customOrigin = (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
          setTimeout(() => cb(null, origin === 'https://allowed.com'), 10);
        };
        const middleware = new CorsMiddleware({ origin: customOrigin });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://allowed.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://allowed.com');
      });

      it('should reject origin via async callback', async () => {
        const customOrigin = (_origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
          cb(null, false);
        };
        const middleware = new CorsMiddleware({ origin: customOrigin });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://any.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
      });

      it('should handle callback error as rejection', async () => {
        const errorOrigin = (_: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
          cb(new Error('Database lookup failed'));
        };
        const middleware = new CorsMiddleware({ origin: errorOrigin });
        const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
      });
    });
  });

  // ============================================
  // 4. Credentials (Fetch Standard §3.2.5)
  // ============================================
  describe('Credentials Handling', () => {
    it('should set Access-Control-Allow-Credentials when enabled', async () => {
      const middleware = new CorsMiddleware({ credentials: true });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowCredentials)).toBe('true');
    });

    it('should NOT set credentials header when disabled', async () => {
      const middleware = new CorsMiddleware({ credentials: false });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowCredentials)).toBeNull();
    });

    /**
     * CRITICAL: Fetch Standard prohibits credentials with wildcard origin
     * "If credentials mode is included and Access-Control-Allow-Origin is `*`,
     * then throw a network error" (at browser level).
     *
     * To support this server-side, we must reflect the origin instead of returning '*'.
     */
    it('should reflect origin (NOT wildcard) when credentials: true and origin: *', async () => {
      const middleware = new CorsMiddleware({ origin: '*', credentials: true });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      // Should reflect the specific origin
      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://example.com');
      // Should also set Vary: Origin (implied by non-wildcard return in middleware logic)
      expect(getResHeader(ctx, HeaderField.Vary)).toBe(HeaderField.Origin);
    });

    it('should reflect origin when credentials: true and origin is default (undefined)', async () => {
      const middleware = new CorsMiddleware({ credentials: true });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://example.com');
      expect(getResHeader(ctx, HeaderField.Vary)).toBe(HeaderField.Origin);
    });
  });

  // ============================================
  // 5. Exposed Headers (Fetch Standard §3.2.5)
  // ============================================
  describe('Exposed Headers', () => {
    it('should set Access-Control-Expose-Headers from array', async () => {
      const middleware = new CorsMiddleware({ exposedHeaders: ['X-Custom', 'X-Request-Id'] });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlExposeHeaders)).toBe('X-Custom,X-Request-Id');
    });

    it('should handle single exposed header string', async () => {
      const middleware = new CorsMiddleware({ exposedHeaders: 'X-Single' });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlExposeHeaders)).toBe('X-Single');
    });

    it('should NOT set header when exposedHeaders is empty array', async () => {
      const middleware = new CorsMiddleware({ exposedHeaders: [] });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlExposeHeaders)).toBeNull();
    });

    it('should NOT set header when exposedHeaders is not specified', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlExposeHeaders)).toBeNull();
    });
  });

  // ============================================
  // 6. Preflight Requests (Fetch Standard §3.2.2)
  // ============================================
  describe('Preflight Requests', () => {
    describe('Basic Preflight Handling', () => {
      it('should handle OPTIONS preflight request', async () => {
        const middleware = new CorsMiddleware();
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        });

        const result = await middleware.handle(ctx.request, ctx.response);

        expect(result).toBe(false);
        expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('*');
        expect(getResHeader(ctx, HeaderField.AccessControlAllowMethods)).toBe(CORS_DEFAULT_METHODS.join(','));
        expect(ctx.response.setStatus).toHaveBeenCalledWith(204);
      });

      it('should use custom optionsSuccessStatus (legacy browser support)', async () => {
        const middleware = new CorsMiddleware({ optionsSuccessStatus: 200 });
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        });

        const result = await middleware.handle(ctx.request, ctx.response);

        expect(result).toBe(false);
        expect(ctx.response.setStatus).toHaveBeenCalledWith(200);
      });

      it('should skip preflight if Access-Control-Request-Method is missing', async () => {
        const middleware = new CorsMiddleware();
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          // Access-Control-Request-Method intentionally omitted
        });

        const result = await middleware.handle(ctx.request, ctx.response);

        expect(result).toBeUndefined();
        expect(getResHeader(ctx, HeaderField.AccessControlAllowMethods)).toBeNull();
        expect(ctx.response.setStatus).not.toHaveBeenCalled();
      });

      it('should continue to next handler if preflightContinue is true', async () => {
        const middleware = new CorsMiddleware({ preflightContinue: true });
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        });

        const result = await middleware.handle(ctx.request, ctx.response);

        expect(result).toBeUndefined();
        expect(ctx.response.setStatus).not.toHaveBeenCalled();
      });
    });

    describe('Allowed Methods', () => {
      it('should use custom methods array', async () => {
        const middleware = new CorsMiddleware({ methods: ['GET', 'POST', 'CUSTOM'] });
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: 'CUSTOM',
        });

        const result = await middleware.handle(ctx.request, ctx.response);

        expect(result).toBe(false);
        expect(getResHeader(ctx, HeaderField.AccessControlAllowMethods)).toBe('GET,POST,CUSTOM');
      });

      it('should use methods as single string', async () => {
        const middleware = new CorsMiddleware({ methods: 'GET,POST' });
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowMethods)).toBe('GET,POST');
      });

      it('should handle empty methods array', async () => {
        const middleware = new CorsMiddleware({ methods: [] });
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowMethods)).toBe('');
      });
    });

    describe('Allowed Headers', () => {
      it('should reflect request headers if allowedHeaders not specified', async () => {
        const middleware = new CorsMiddleware();
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
          [HeaderField.AccessControlRequestHeaders]: 'X-Custom-Header,Authorization',
        });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowHeaders)).toBe('X-Custom-Header,Authorization');
        expect(getResHeader(ctx, HeaderField.Vary)).toContain(HeaderField.AccessControlRequestHeaders);
      });

      it('should use specified allowedHeaders array', async () => {
        const middleware = new CorsMiddleware({ allowedHeaders: ['Content-Type', 'Authorization'] });
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
          [HeaderField.AccessControlRequestHeaders]: 'X-Ignored',
        });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowHeaders)).toBe('Content-Type,Authorization');
      });

      it('should use allowedHeaders as single string', async () => {
        const middleware = new CorsMiddleware({ allowedHeaders: 'Content-Type,X-Api-Key' });
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowHeaders)).toBe('Content-Type,X-Api-Key');
      });

      it('should NOT set Access-Control-Allow-Headers if no request headers and no config', async () => {
        const middleware = new CorsMiddleware();
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
          // No Access-Control-Request-Headers
        });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlAllowHeaders)).toBeNull();
      });
    });

    describe('Max Age', () => {
      it('should set Access-Control-Max-Age', async () => {
        const middleware = new CorsMiddleware({ maxAge: 86400 });
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlMaxAge)).toBe('86400');
      });

      it('should handle maxAge: 0', async () => {
        const middleware = new CorsMiddleware({ maxAge: 0 });
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlMaxAge)).toBe('0');
      });

      it('should NOT set maxAge if not specified', async () => {
        const middleware = new CorsMiddleware();
        const ctx = createMockContext(HttpMethod.Options, {
          [HeaderField.Origin]: 'https://example.com',
          [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        });

        await middleware.handle(ctx.request, ctx.response);

        expect(getResHeader(ctx, HeaderField.AccessControlMaxAge)).toBeNull();
      });
    });
  });

  // ============================================
  // 7. Simple/Actual Requests (non-preflight)
  // ============================================
  describe('Simple/Actual Requests', () => {
    it('should handle GET request with CORS headers', async () => {
      const middleware = new CorsMiddleware({ origin: true, credentials: true });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      const result = await middleware.handle(ctx.request, ctx.response);

      expect(result).toBeUndefined();
      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://example.com');
      expect(getResHeader(ctx, HeaderField.AccessControlAllowCredentials)).toBe('true');
    });

    it('should handle HEAD request', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext(HttpMethod.Head, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('*');
    });

    it('should handle POST request', async () => {
      const middleware = new CorsMiddleware({ origin: 'https://api.example.com' });
      const ctx = createMockContext(HttpMethod.Post, { [HeaderField.Origin]: 'https://api.example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://api.example.com');
    });

    it('should handle PUT request', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext(HttpMethod.Put, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('*');
    });

    it('should handle DELETE request', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext(HttpMethod.Delete, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('*');
    });

    it('should handle PATCH request', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext(HttpMethod.Patch, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('*');
    });
  });

  // ============================================
  // 8. Vary Header Handling (Fetch Standard §3.2.5)
  // ============================================
  describe('Vary Header Handling', () => {
    it('should set Vary: Origin when reflecting specific origin', async () => {
      const middleware = new CorsMiddleware({ origin: true });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.Vary)).toBe(HeaderField.Origin);
    });

    it('should append to Vary header for preflight with reflected headers', async () => {
      const middleware = new CorsMiddleware({ origin: true });
      const ctx = createMockContext(HttpMethod.Options, {
        [HeaderField.Origin]: 'https://example.com',
        [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        [HeaderField.AccessControlRequestHeaders]: 'X-Custom',
      });

      await middleware.handle(ctx.request, ctx.response);

      const vary = getResHeader(ctx, HeaderField.Vary);
      expect(vary).toContain(HeaderField.Origin);
      expect(vary).toContain(HeaderField.AccessControlRequestHeaders);
    });

    it('should NOT set Vary for wildcard origin', async () => {
      const middleware = new CorsMiddleware({ origin: '*' });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.Vary)).toBeNull();
    });
  });

  // ============================================
  // 9. Edge Cases and Security
  // ============================================
  describe('Edge Cases and Security', () => {
    it('should handle origin with port', async () => {
      const middleware = new CorsMiddleware({ origin: 'http://localhost:3000' });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'http://localhost:3000' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('http://localhost:3000');
    });

    it('should handle origin with different ports as different origins', async () => {
      const middleware = new CorsMiddleware({ origin: 'http://localhost:3000' });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'http://localhost:4000' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
    });

    it('should handle origin with trailing slash in request (unusual)', async () => {
      const middleware = new CorsMiddleware({ origin: 'https://example.com' });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com/' });

      await middleware.handle(ctx.request, ctx.response);

      // Origins should not have trailing slash, so this should not match
      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
    });

    it('should reject protocol mismatch (http vs https)', async () => {
      const middleware = new CorsMiddleware({ origin: 'https://example.com' });
      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'http://example.com' });

      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
    });

    it('should handle uppercase method in request', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext('OPTIONS', {
        [HeaderField.Origin]: 'https://example.com',
        [HeaderField.AccessControlRequestMethod]: 'POST',
      });

      const result = await middleware.handle(ctx.request, ctx.response);

      expect(result).toBe(false);
    });

    it('should handle multiple origins in sequence (middleware reuse)', async () => {
      const middleware = new CorsMiddleware({ origin: ['https://a.com', 'https://b.com'] });

      const ctx1 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://a.com' });
      await middleware.handle(ctx1.request, ctx1.response);
      expect(getResHeader(ctx1, HeaderField.AccessControlAllowOrigin)).toBe('https://a.com');

      const ctx2 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://b.com' });
      await middleware.handle(ctx2.request, ctx2.response);
      expect(getResHeader(ctx2, HeaderField.AccessControlAllowOrigin)).toBe('https://b.com');

      const ctx3 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://c.com' });
      await middleware.handle(ctx3.request, ctx3.response);
      expect(getResHeader(ctx3, HeaderField.AccessControlAllowOrigin)).toBeNull();
    });
  });

  // ============================================
  // 10. Complete Configuration Scenarios
  // ============================================
  describe('Complete Configuration Scenarios', () => {
    it('should handle full production-like configuration', async () => {
      const middleware = new CorsMiddleware({
        origin: ['https://app.example.com', /\.example\.com$/],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
        exposedHeaders: ['X-Response-Time', 'X-Request-Id'],
        credentials: true,
        maxAge: 86400,
        optionsSuccessStatus: 204,
      });

      // Preflight request
      const preflightCtx = createMockContext(HttpMethod.Options, {
        [HeaderField.Origin]: 'https://app.example.com',
        [HeaderField.AccessControlRequestMethod]: 'PUT',
        [HeaderField.AccessControlRequestHeaders]: 'Content-Type,Authorization',
      });

      const preflightResult = await middleware.handle(preflightCtx.request, preflightCtx.response);

      expect(preflightResult).toBe(false);
      expect(getResHeader(preflightCtx, HeaderField.AccessControlAllowOrigin)).toBe('https://app.example.com');
      expect(getResHeader(preflightCtx, HeaderField.AccessControlAllowMethods)).toBe('GET,POST,PUT,DELETE');
      expect(getResHeader(preflightCtx, HeaderField.AccessControlAllowHeaders)).toBe('Content-Type,Authorization,X-Request-Id');
      expect(getResHeader(preflightCtx, HeaderField.AccessControlAllowCredentials)).toBe('true');
      expect(getResHeader(preflightCtx, HeaderField.AccessControlMaxAge)).toBe('86400');
      expect(getResHeader(preflightCtx, HeaderField.Vary)).toContain(HeaderField.Origin);

      // Actual request
      const actualCtx = createMockContext(HttpMethod.Put, {
        [HeaderField.Origin]: 'https://api.example.com',
      });

      const actualResult = await middleware.handle(actualCtx.request, actualCtx.response);

      expect(actualResult).toBeUndefined();
      expect(getResHeader(actualCtx, HeaderField.AccessControlAllowOrigin)).toBe('https://api.example.com');
      expect(getResHeader(actualCtx, HeaderField.AccessControlExposeHeaders)).toBe('X-Response-Time,X-Request-Id');
      expect(getResHeader(actualCtx, HeaderField.AccessControlAllowCredentials)).toBe('true');
    });

    it('should handle minimal/default configuration', async () => {
      const middleware = new CorsMiddleware();

      const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://any.com' });
      await middleware.handle(ctx.request, ctx.response);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('*');
      expect(getResHeader(ctx, HeaderField.AccessControlAllowCredentials)).toBeNull();
      expect(getResHeader(ctx, HeaderField.AccessControlExposeHeaders)).toBeNull();
    });

    it('should handle strict single-origin configuration', async () => {
      const middleware = new CorsMiddleware({
        origin: 'https://trusted.com',
        credentials: true,
        maxAge: 3600,
      });

      const allowedCtx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://trusted.com' });
      await middleware.handle(allowedCtx.request, allowedCtx.response);
      expect(getResHeader(allowedCtx, HeaderField.AccessControlAllowOrigin)).toBe('https://trusted.com');

      const blockedCtx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://untrusted.com' });
      await middleware.handle(blockedCtx.request, blockedCtx.response);
      expect(getResHeader(blockedCtx, HeaderField.AccessControlAllowOrigin)).toBeNull();
    });
  });
});
