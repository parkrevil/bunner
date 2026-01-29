import { describe, expect, it } from 'bun:test';

import { inject } from './helpers';

describe('inject', () => {
  it('should throw when inject is called at runtime', () => {
    expect(() => inject('Token')).toThrow(/AOT-only/);
  });
});