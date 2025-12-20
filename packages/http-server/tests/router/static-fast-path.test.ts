import { describe, it, expect } from 'bun:test';

import { Router } from '../../src/router/router';
import type { MatchResultMeta } from '../../src/router/types';

describe('Router Static Fast-path', () => {
  it('should use static-fast source for purely static routes', () => {
    const router = new Router();

    const handler = (_params: any, meta: MatchResultMeta) => meta;

    router.add('GET', '/static', handler);

    router.build();

    const result = router.match('GET', '/static');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('static-fast');
  });

  it('should use dynamic source for routes with params', () => {
    const router = new Router();
    const handler = (_params: any, meta: MatchResultMeta) => meta;

    router.add('GET', '/user/:id', handler);
    router.build();

    const result = router.match('GET', '/user/123');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('dynamic');
  });

  it('should use dynamic source for routes with wildcards', () => {
    const router = new Router();
    const handler = (_params: any, meta: MatchResultMeta) => meta;

    router.add('GET', '/files/*', handler);
    router.build();

    const result = router.match('GET', '/files/doc.txt');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('dynamic');
  });

  it('should respect normalization options in fast-path (trailing slash)', () => {
    const router = new Router({ ignoreTrailingSlash: true });
    const handler = (_params: any, meta: MatchResultMeta) => meta;

    router.add('GET', '/foo', handler);
    router.build();

    const result = router.match('GET', '/foo/');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('static-fast');
  });

  it('should not hit fast-path if normalization produces different path not in map', () => {
    const router = new Router({ ignoreTrailingSlash: false });
    router.add('GET', '/foo', () => 'ok');
    const result = router.match('GET', '/foo/');
    expect(result).toBeNull();
  });
});
