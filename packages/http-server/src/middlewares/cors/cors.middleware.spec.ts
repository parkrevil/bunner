import { describe, expect, it, mock } from 'bun:test';

import type { HttpContext } from '../../adapter';
import { HTTP_CONTEXT_TYPE } from '../../constants';
import { HeaderField, HttpMethod } from '../../enums';

import { CORS_DEFAULT_METHODS } from './constants';
import { CorsMiddleware } from './cors.middleware';

describe('CorsMiddleware', () => {
  const createMockContext = (method: HttpMethod, headers: Record<string, string> = {}) => {
    const reqHeaders = new Headers(headers);
    const setStatus = mock();
    // Headers map to simulate state if needed, but for simple tests mock calls are often enough.
    // However, the test assertions use `ctx.response.headers.get()`.
    // We need to simulate property access OR update assertions to check mock calls.
    // Updating assertions is better for unit testing "behavior".

    // To support `ctx.response.headers.get` style assertions from previous tests without rewriting ALL of them heavily:
    // We can back the mocks with a real Headers object?
    const resHeaders = new Headers();

    const setHeaderImpl = (k: string, v: string) => {
      resHeaders.set(k, v);
    };
    const appendHeaderImpl = (k: string, v: string) => {
      // Headers.append treats existing as comma separated
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
      // Helper for test assertions: allow peeking into headers
      _testHeaders: resHeaders,
      // But wait, the middleware calls methods. The tests assert on `ctx.response.headers.get`.
      // `BunnerResponse` does NOT have `.headers`.
      // So the test assertions MUST change.
    };

    return {
      getType: () => HTTP_CONTEXT_TYPE,
      get: () => undefined,
      request: requestObj,
      response: responseObj,
    } as unknown as HttpContext;
  };

  const getResHeader = (ctx: any, name: string) => {
    // Helper to read from our mock's backing store
    return ctx.response._testHeaders.get(name);
  };

  it('should proceed if no Origin header', async () => {
    const middleware = new CorsMiddleware();
    const ctx = createMockContext(HttpMethod.Get);

    await middleware.handle(ctx);

    expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
  });

  it('should set Access-Control-Allow-Origin to * by default', async () => {
    const middleware = new CorsMiddleware();
    const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

    await middleware.handle(ctx);

    expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('*');
  });

  it('should reflect origin if configured as boolean true', async () => {
    const middleware = new CorsMiddleware({ origin: true });
    const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

    await middleware.handle(ctx);

    expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://example.com');
    expect(getResHeader(ctx, HeaderField.Vary)).toBe(HeaderField.Origin);
  });

  it('should not set header if origin does not match string', async () => {
    const middleware = new CorsMiddleware({ origin: 'https://allowed.com' });
    const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://forbidden.com' });

    await middleware.handle(ctx);

    expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
  });

  it('should set header if origin matches string', async () => {
    const middleware = new CorsMiddleware({ origin: 'https://allowed.com' });
    const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://allowed.com' });

    await middleware.handle(ctx);

    expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://allowed.com');
    expect(getResHeader(ctx, HeaderField.Vary)).toBe(HeaderField.Origin);
  });

  it('should match regex origin', async () => {
    const middleware = new CorsMiddleware({ origin: /\.example\.com$/ });
    const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://sub.example.com' });

    await middleware.handle(ctx);

    expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('https://sub.example.com');
  });

  it('should handle array of origins', async () => {
    const middleware = new CorsMiddleware({ origin: ['https://a.com', /\.b\.com$/] });

    const ctx1 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://a.com' });
    await middleware.handle(ctx1);
    expect(getResHeader(ctx1, HeaderField.AccessControlAllowOrigin)).toBe('https://a.com');

    const ctx2 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://sub.b.com' });
    await middleware.handle(ctx2);
    expect(getResHeader(ctx2, HeaderField.AccessControlAllowOrigin)).toBe('https://sub.b.com');

    const ctx3 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://c.com' });
    await middleware.handle(ctx3);
    expect(getResHeader(ctx3, HeaderField.AccessControlAllowOrigin)).toBeNull();
  });

  it('should handle custom origin function', async () => {
    const customOrigin = (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (origin === 'https://secret.com') {
        cb(null, true);
      } else {
        cb(null, false);
      }
    };
    const middleware = new CorsMiddleware({ origin: customOrigin });

    const ctx1 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://secret.com' });
    await middleware.handle(ctx1);
    expect(getResHeader(ctx1, HeaderField.AccessControlAllowOrigin)).toBe('https://secret.com');

    const ctx2 = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://public.com' });
    await middleware.handle(ctx2);
    expect(getResHeader(ctx2, HeaderField.AccessControlAllowOrigin)).toBeNull();
  });

  it('should handle custom origin function error as not allowed', async () => {
    const errorOrigin = (_: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      cb(new Error('Auth failed'));
    };
    const middleware = new CorsMiddleware({ origin: errorOrigin });
    const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

    await middleware.handle(ctx);

    expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBeNull();
  });

  it('should set credentials header', async () => {
    const middleware = new CorsMiddleware({ credentials: true });
    const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

    await middleware.handle(ctx);
    expect(getResHeader(ctx, HeaderField.AccessControlAllowCredentials)).toBe('true');
  });

  it('should set exposed headers', async () => {
    const middleware = new CorsMiddleware({ exposedHeaders: ['X-Custom', 'X-Time'] });
    const ctx = createMockContext(HttpMethod.Get, { [HeaderField.Origin]: 'https://example.com' });

    await middleware.handle(ctx);
    expect(getResHeader(ctx, HeaderField.AccessControlExposeHeaders)).toBe('X-Custom,X-Time');
  });

  describe('Preflight Requests', () => {
    it('should handle OPTIONS request', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext(HttpMethod.Options, {
        [HeaderField.Origin]: 'https://example.com',
        [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
      });

      const result = await middleware.handle(ctx);
      expect(result).toBe(false);

      expect(getResHeader(ctx, HeaderField.AccessControlAllowOrigin)).toBe('*');
      expect(getResHeader(ctx, HeaderField.AccessControlAllowMethods)).toBe(CORS_DEFAULT_METHODS.join(','));
      expect(ctx.response.setStatus).toHaveBeenCalledWith(204);
    });

    it('should use custom optionsSuccessStatus', async () => {
      const middleware = new CorsMiddleware({ optionsSuccessStatus: 200 });
      const ctx = createMockContext(HttpMethod.Options, {
        [HeaderField.Origin]: 'https://example.com',
        [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
      });

      const result = await middleware.handle(ctx);
      expect(result).toBe(false);
      expect(ctx.response.setStatus).toHaveBeenCalledWith(200);
    });

    it('should continue if preflightContinue is true', async () => {
      const middleware = new CorsMiddleware({ preflightContinue: true });
      const ctx = createMockContext(HttpMethod.Options, {
        [HeaderField.Origin]: 'https://example.com',
        [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
      });

      const result = await middleware.handle(ctx);
      expect(result).toBeUndefined(); // Should NOT be false
      expect(ctx.response.setStatus).not.toHaveBeenCalled();
    });

    it('should allow custom methods in preflight', async () => {
      const middleware = new CorsMiddleware({ methods: ['GET', 'POST', 'GRAPHQL'] });
      const ctx = createMockContext(HttpMethod.Options, {
        [HeaderField.Origin]: 'https://example.com',
        [HeaderField.AccessControlRequestMethod]: 'GRAPHQL',
      });

      const result = await middleware.handle(ctx);
      expect(result).toBe(false);
      expect(getResHeader(ctx, HeaderField.AccessControlAllowMethods)).toBe('GET,POST,GRAPHQL');
    });

    it('should reflect allowed headers if not specified', async () => {
      const middleware = new CorsMiddleware();
      const ctx = createMockContext(HttpMethod.Options, {
        [HeaderField.Origin]: 'https://example.com',
        [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        [HeaderField.AccessControlRequestHeaders]: 'X-Ping,X-Pong',
      });

      const result = await middleware.handle(ctx);
      expect(result).toBe(false);
      expect(getResHeader(ctx, HeaderField.AccessControlAllowHeaders)).toBe('X-Ping,X-Pong');
      expect(getResHeader(ctx, HeaderField.Vary)).toContain(HeaderField.AccessControlRequestHeaders);
    });

    it('should use specified allowed headers', async () => {
      const middleware = new CorsMiddleware({ allowedHeaders: ['Content-Type', 'Authorization'] });
      const ctx = createMockContext(HttpMethod.Options, {
        [HeaderField.Origin]: 'https://example.com',
        [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
        [HeaderField.AccessControlRequestHeaders]: 'X-Ping',
      });

      const result = await middleware.handle(ctx);
      expect(result).toBe(false);
      expect(getResHeader(ctx, HeaderField.AccessControlAllowHeaders)).toBe('Content-Type,Authorization');
    });

    it('should set max age', async () => {
      const middleware = new CorsMiddleware({ maxAge: 86400 });
      const ctx = createMockContext(HttpMethod.Options, {
        [HeaderField.Origin]: 'https://example.com',
        [HeaderField.AccessControlRequestMethod]: HttpMethod.Post,
      });

      const result = await middleware.handle(ctx);
      expect(result).toBe(false);
      expect(getResHeader(ctx, HeaderField.AccessControlMaxAge)).toBe('86400');
    });
  });
});
