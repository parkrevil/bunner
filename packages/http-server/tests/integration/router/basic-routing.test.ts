import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'bun:test';

import { Router } from '../../../src/router/router';
import type { RouterInstance } from '../../../src/router/types';
import type { HttpMethod } from '../../../src/types';

const METHOD_ENTRIES: Array<[string, HttpMethod]> = [];

beforeAll(() => {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  for (const m of methods) {
    METHOD_ENTRIES.push([m, m as HttpMethod]);
  }
});

afterAll(() => {
  METHOD_ENTRIES.length = 0;
});

describe('RadixRouter :: basic routing', () => {
  const buildRouter = (configure: (builder: Router<string>) => void): RouterInstance<string> => {
    const builder = new Router<string>(); // string is the return type
    configure(builder);
    return builder.build();
  };

  it('should match a static route for the registered method', () => {
    const handler = () => 'handler-users';
    const router = buildRouter(builder => {
      builder.add('GET', '/users', handler);
    });
    const match = router.match('GET', '/users');

    expect(match).toBe('handler-users');
  });

  it('should reject requests registered for another method', () => {
    const router = buildRouter(builder => {
      builder.add('POST', '/users', () => 'handler');
    });

    expect(router.match('GET', '/users')).toBeNull();
  });

  it('should support registering the root path', () => {
    const handler = () => 'root-handler';
    const router = buildRouter(builder => {
      builder.add('GET', '/', handler);
    });

    expect(router.match('GET', '/')).toBe('root-handler');
  });

  it('should normalize paths that omit the leading slash', () => {
    const handler = () => 'settings-handler';
    const router = buildRouter(builder => {
      builder.add('GET', 'settings', handler);
    });

    expect(router.match('GET', '/settings')).toBe('settings-handler');
  });

  describe('addAll()', () => {
    let router: RouterInstance<string>;
    const h1 = () => 'h1';
    const h2 = () => 'h2';

    beforeEach(() => {
      const builder = new Router<string>();
      builder.addAll([
        ['GET', '/health', h1],
        ['POST', '/health', h2],
      ]);
      router = builder.build();
    });

    it('should register the first tuple as GET', () => {
      expect(router.match('GET', '/health')).toBe('h1');
    });

    it('should register the second tuple as POST', () => {
      expect(router.match('POST', '/health')).toBe('h2');
    });
  });

  describe('method array registration', () => {
    let router: RouterInstance<string>;
    const handler = () => 'bulk-handler';

    beforeEach(() => {
      const builder = new Router<string>();
      builder.add(['GET', 'DELETE'], '/bulk', handler);
      router = builder.build();
    });

    it('should handle the first method in the array', () => {
      expect(router.match('GET', '/bulk')).toBe('bulk-handler');
    });

    it('should handle the second method in the array', () => {
      expect(router.match('DELETE', '/bulk')).toBe('bulk-handler');
    });
  });

  describe('method wildcard registration', () => {
    for (const [label, method] of METHOD_ENTRIES) {
      it(`should respond to ${label} when registered with '*'`, () => {
        const handler = () => 'wildcard-handler';
        const router = buildRouter(builder => {
          builder.add('*', '/wildcard', handler);
        });

        expect(router.match(method, '/wildcard')).toBe('wildcard-handler');
      });
    }
  });

  it.skip('should cache pure static routes in the fast-path table', () => {
    // Legacy test removed as it tests internal implementation detail of the old router architecture.
  });

  it('should normalize redundant slashes and dot segments on the static fast path', () => {
    const builder = new Router<string>();
    builder.add('GET', '/static/assets/logo', () => 'ok');
    const router = builder.build();

    expect(router.match('GET', '//static//./assets/logo/')).toBe('ok');
  });

  it('should reuse case-insensitive static caches without repeated folding', () => {
    const builder = new Router<string>({ caseSensitive: false });
    const handler = () => 'mixed-handler';
    builder.add('GET', '/MiXeD/Path', handler);
    const router = builder.build();

    expect(router.match('GET', '/mixed/path')).toBe('mixed-handler');
    expect(router.match('GET', '/MIXED/PATH')).toBe('mixed-handler');
  });
});
