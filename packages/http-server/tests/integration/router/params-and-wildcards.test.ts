import { describe, it, expect } from 'bun:test';

import { Router } from '../../../src/router/router';

describe('Router :: params and wildcards', () => {
  const buildRouter = (configure: (builder: Router) => void, options?: ConstructorParameters<typeof Router>[0]): Router => {
    const builder = new Router(options);
    configure(builder);
    return builder.build();
  };

  describe('optional parameters', () => {
    it('should match simple named parameters', () => {
      const builder = new Router();
      builder.add('GET', '/product/:id', params => ({ handler: 'h1', params }));
      const router = builder.build();

      const result = router.match('GET', '/product/123');
      expect(result).toEqual({
        handler: 'h1',
        params: { id: '123' },
      });
    });

    it('should match multiple named parameters', () => {
      const builder = new Router();
      builder.add('GET', '/:category/:id', params => ({ handler: 'h1', params }));
      const router = builder.build();

      expect(router.match('GET', '/books/abc')?.params).toEqual({
        category: 'books',
        id: 'abc',
      });
    });
    it('should expose undefined when configured to setUndefined', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/users/:id?', params => ({ params }));
        },
        { optionalParamBehavior: 'setUndefined' },
      );

      const match = router.match('GET', '/users');
      expect(match).not.toBeNull();
      expect(match?.params).toHaveProperty('id');
      expect(match?.params.id).toBeUndefined();
    });

    it('should expose empty strings when configured to setEmptyString', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/users/:id?', params => ({ params }));
        },
        { optionalParamBehavior: 'setEmptyString' },
      );

      const match = router.match('GET', '/users');
      expect(match?.params.id).toBe('');
    });
  });

  describe('regex-constrained parameters', () => {
    it('should match when the path satisfies the regex', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/orders/:id{[0-9]+}', params => ({ params }));
      });

      expect(router.match('GET', '/orders/123')?.params.id).toBe('123');
    });

    it('should fail when the path violates the regex', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/orders/:id{[0-9]+}', () => 'ok');
      });

      expect(router.match('GET', '/orders/abc')).toBeNull();
    });
  });

  describe('multi-segment parameters', () => {
    it('should support multi-segment params (+)', () => {
      const builder = new Router();
      builder.add('GET', '/files/:path+', params => ({ params }));
      const router = builder.build();

      expect(router.match('GET', '/files/a/b/c')?.params['path']).toBe('a/b/c');
    });

    it('should fail when no additional segment is present', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/files/:rest+', () => 'ok');
      });

      expect(router.match('GET', '/files')).toBeNull();
    });
  });

  it('should support zero-or-more params (*)', () => {
    const builder = new Router();
    builder.add('GET', '/static/:file*', params => ({ params }));
    const router = builder.build();

    expect(router.match('GET', '/static/a/b')?.params['file']).toBe('a/b');
    expect(router.match('GET', '/static')?.params['file']).toBe('');
  });

  it('should capture nested segments when present', () => {
    const router = buildRouter(builder => {
      builder.add('GET', '/logs/:tail*', params => ({ params }));
    });
    expect(router.match('GET', '/logs/2025/nov/17')?.params.tail).toBe('2025/nov/17');
  });

  describe('wildcards', () => {
    it('should return the remainder under "*" when unnamed', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/static/*', params => ({ params }));
      });

      expect(router.match('GET', '/static/css/app.css')?.params['*']).toBe('css/app.css');
    });

    it('should store the remainder under the provided wildcard name', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/proxy/*path', params => ({ params }));
      });

      expect(router.match('GET', '/proxy/v1/api/users')?.params.path).toBe('v1/api/users');
    });

    it('should capture the entire path when the wildcard sits at the root', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/*', params => ({ params }));
      });

      expect(router.match('GET', '/any/path')?.params['*']).toBe('any/path');
    });

    it('should emit an empty string when no remainder exists', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/static/*asset', params => ({ params }));
      });

      expect(router.match('GET', '/static')?.params.asset).toBe('');
    });

    it('should reuse precomputed suffix metadata across repeated matches', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/assets/*rest', params => ({ params }));
      });

      expect(router.match('GET', '/assets/img/logo.svg')?.params.rest).toBe('img/logo.svg');
      expect(router.match('GET', '/assets/img/logo.svg')?.params.rest).toBe('img/logo.svg');
    });
  });

  describe('matching priority and decoding', () => {
    it('should prioritize regex-constrained params over generic ones regardless of registration order', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/articles/:slug', () => 'slug');
        builder.add('GET', '/articles/:id{[0-9]+}', () => 'numeric');
      });

      expect(router.match('GET', '/articles/42')).toBe('numeric');
      expect(router.match('GET', '/articles/hello')).toBe('slug');
    });

    it('should evaluate regex constraints against decoded parameter values when decoding is enabled', () => {
      const router = buildRouter(builder => {
        builder.add('GET', '/files/:name{[^\\u002F]+}', () => 'ok');
      });

      expect(router.match('GET', '/files/foo%2Fbar')).toBeNull();
    });

    it('should allow encoded values to bypass regex checks when decoding is disabled', () => {
      const router = buildRouter(
        builder => {
          builder.add('GET', '/files/:name{[^\\u002F]+}', () => 'ok');
        },
        { decodeParams: false },
      );

      expect(router.match('GET', '/files/foo%2Fbar')).toBe('ok');
    });
  });
});
