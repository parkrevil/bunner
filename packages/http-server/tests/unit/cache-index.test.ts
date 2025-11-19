import { describe, it, expect } from 'bun:test';

import { CacheIndex } from '../../src/router/cache/cache-index';

describe('CacheIndex cleanup semantics', () => {
  it('removes all orphaned nodes once the last key for a branch is deleted', () => {
    const index = new CacheIndex();
    const cacheKey = 'GET\0/users/profile';
    index.add('/users/profile', cacheKey);
    expect(index.debugStats().nodeCount).toBeGreaterThan(1);

    index.remove('/users/profile', cacheKey);

    expect(index.debugStats().nodeCount).toBe(1);
    const acc: string[] = [];
    index.collectPrefix('/users', 'GET', acc);
    expect(acc).toHaveLength(0);
  });

  it('retains sibling nodes while still pruning the removed branch', () => {
    const index = new CacheIndex();
    const first = 'GET\0/files/static';
    const second = 'GET\0/files/images';
    index.add('/files/static', first);
    index.add('/files/images', second);

    index.remove('/files/images', second);

    const acc: string[] = [];
    index.collectPrefix('/files', 'GET', acc);
    expect(acc).toEqual([first]);
    expect(index.debugStats().nodeCount).toBeGreaterThan(1);
  });
});
