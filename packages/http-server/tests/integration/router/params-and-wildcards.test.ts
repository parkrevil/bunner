import { describe, it, expect } from 'bun:test';

import { HttpMethod } from '../../../src/enums';
import { RadixRouterBuilder } from '../../../src/router/router';
import type { RouteKey } from '../../../src/types';

describe('RadixRouter :: params and wildcards', () => {
  const buildRouter = (
    configure: (builder: RadixRouterBuilder) => void,
    options?: ConstructorParameters<typeof RadixRouterBuilder>[0],
  ): ReturnType<RadixRouterBuilder['build']> => {
    const builder = new RadixRouterBuilder(options);
    configure(builder);
    return builder.build();
  };

  describe('optional parameters', () => {
    it('should match the base route even without a value', () => {
      let key!: RouteKey;
      const router = buildRouter(builder => {
        key = builder.add(HttpMethod.Get, '/users/:id?') as RouteKey;
      });

      expect(router.match(HttpMethod.Get, '/users')).toEqual({ key, params: {} });
    });

    it('should store a provided value in params', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/users/:id?');
      });

      expect(router.match(HttpMethod.Get, '/users/42')?.params.id).toBe('42');
    });

    it('should expose undefined when configured to setUndefined', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/users/:id?');
        },
        { optionalParamBehavior: 'setUndefined' },
      );

      const match = router.match(HttpMethod.Get, '/users');
      expect(match).not.toBeNull();
      expect(match?.params).toHaveProperty('id');
      expect(match?.params.id).toBeUndefined();
    });

    it('should expose empty strings when configured to setEmptyString', () => {
      const router = buildRouter(
        builder => {
          builder.add(HttpMethod.Get, '/users/:id?');
        },
        { optionalParamBehavior: 'setEmptyString' },
      );

      const match = router.match(HttpMethod.Get, '/users');
      expect(match?.params.id).toBe('');
    });
  });

  describe('regex-constrained parameters', () => {
    it('should match when the path satisfies the regex', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/orders/:id{[0-9]+}');
      });

      expect(router.match(HttpMethod.Get, '/orders/123')?.params.id).toBe('123');
    });

    it('should fail when the path violates the regex', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/orders/:id{[0-9]+}');
      });

      expect(router.match(HttpMethod.Get, '/orders/abc')).toBeNull();
    });
  });

  describe('multi-segment parameters', () => {
    it('should capture the remaining segments as a single string', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/files/:rest+');
      });

      expect(router.match(HttpMethod.Get, '/files/a/b/c')?.params.rest).toBe('a/b/c');
    });

    it('should fail when no additional segment is present', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/files/:rest+');
      });

      expect(router.match(HttpMethod.Get, '/files')).toBeNull();
    });
  });

  describe('zero-or-more parameters', () => {
    it('should capture empty remainders as empty strings', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/logs/:tail*');
      });

      expect(router.match(HttpMethod.Get, '/logs')?.params.tail).toBe('');
    });

    it('should capture nested segments when present', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/logs/:tail*');
      });

      expect(router.match(HttpMethod.Get, '/logs/2025/nov/17')?.params.tail).toBe('2025/nov/17');
    });
  });

  describe('wildcards', () => {
    it('should return the remainder under "*" when unnamed', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/static/*');
      });

      expect(router.match(HttpMethod.Get, '/static/css/app.css')?.params['*']).toBe('css/app.css');
    });

    it('should store the remainder under the provided wildcard name', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/proxy/*path');
      });

      expect(router.match(HttpMethod.Get, '/proxy/v1/api/users')?.params.path).toBe('v1/api/users');
    });

    it('should capture the entire path when the wildcard sits at the root', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/*');
      });

      expect(router.match(HttpMethod.Get, '/any/path')?.params['*']).toBe('any/path');
    });

    it('should emit an empty string when no remainder exists', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/static/*asset');
      });

      expect(router.match(HttpMethod.Get, '/static')?.params.asset).toBe('');
    });

    it('should reuse precomputed suffix metadata across repeated matches', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/assets/*rest');
      });

      expect(router.match(HttpMethod.Get, '/assets/img/logo.svg')?.params.rest).toBe('img/logo.svg');
      expect(router.match(HttpMethod.Get, '/assets/img/logo.svg')?.params.rest).toBe('img/logo.svg');
    });
  });

  describe('matching priority and decoding', () => {
    it('should prioritize regex-constrained params over generic ones regardless of registration order', () => {
      let slugKey!: RouteKey;
      let numericKey!: RouteKey;
      const router = buildRouter(builder => {
        slugKey = builder.add(HttpMethod.Get, '/articles/:slug') as RouteKey;
        numericKey = builder.add(HttpMethod.Get, '/articles/:id{[0-9]+}') as RouteKey;
      });

      expect(router.match(HttpMethod.Get, '/articles/42')?.key).toBe(numericKey);
      expect(router.match(HttpMethod.Get, '/articles/hello')?.key).toBe(slugKey);
    });

    it('should evaluate regex constraints against decoded parameter values when decoding is enabled', () => {
      const router = buildRouter(builder => {
        builder.add(HttpMethod.Get, '/files/:name{[^\\u002F]+}');
      });

      expect(router.match(HttpMethod.Get, '/files/foo%2Fbar')).toBeNull();
    });

    it('should allow encoded values to bypass regex checks when decoding is disabled', () => {
      let key!: RouteKey;
      const router = buildRouter(
        builder => {
          key = builder.add(HttpMethod.Get, '/files/:name{[^\\u002F]+}') as RouteKey;
        },
        { decodeParams: false },
      );

      expect(router.match(HttpMethod.Get, '/files/foo%2Fbar')?.key).toBe(key);
    });
  });

  describe('param ordering snapshots', () => {
    it('should export and hydrate param edge counters between builds', () => {
      const firstBuilder = new RadixRouterBuilder({ paramOrderTuning: { baseThreshold: 1, reseedProbability: 1 } });
      firstBuilder.add(HttpMethod.Get, '/lookup/:id{[0-9]+}');
      firstBuilder.add(HttpMethod.Get, '/lookup/:slug{[a-z]+}');
      const firstRouter = firstBuilder.build();

      firstRouter.match(HttpMethod.Get, '/lookup/alpha');
      firstRouter.match(HttpMethod.Get, '/lookup/beta');
      const snapshot = firstRouter.exportParamOrderSnapshot();

      expect(snapshot).not.toBeNull();
      expect(snapshot?.edgeHits.some(count => count > 0)).toBe(true);

      const secondBuilder = new RadixRouterBuilder({
        paramOrderTuning: { baseThreshold: 4, reseedProbability: 0.5, snapshot: snapshot! },
      });
      secondBuilder.add(HttpMethod.Get, '/lookup/:id{[0-9]+}');
      secondBuilder.add(HttpMethod.Get, '/lookup/:slug{[a-z]+}');
      const secondRouter = secondBuilder.build();

      expect(secondRouter.exportParamOrderSnapshot()).toEqual(snapshot);
    });
  });
});
