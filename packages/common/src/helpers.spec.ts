import { describe, expect, it } from 'bun:test';

import { inject } from './helpers';

describe('inject', () => {
  it('should throw when inject is called at runtime', () => {
    expect(() => inject('Token')).toThrow(/AOT-only/);
  });

  it('should throw with descriptive message about AOT requirement', () => {
    expect(() => inject('MyService')).toThrow(/AOT-only/);
  });

  it('should throw when called with number token', () => {
    expect(() => inject(123 as any)).toThrow(/AOT-only/);
  });

  it('should throw when called with object token', () => {
    expect(() => inject({ provide: 'Token' } as any)).toThrow(/AOT-only/);
  });

  it('should throw when called with undefined token', () => {
    expect(() => inject(undefined as any)).toThrow(/AOT-only/);
  });

  it('should throw when called with null token', () => {
    expect(() => inject(null as any)).toThrow(/AOT-only/);
  });

  it('should be a function with correct name', () => {
    expect(typeof inject).toBe('function');
    expect(inject.name).toBe('inject');
  });

  it('should accept string tokens in type system (compile-time check)', () => {
    // This test verifies the function signature accepts string tokens
    // Runtime execution will throw, but the call should be valid TypeScript
    const tokenCall = () => inject('ValidToken');

    expect(tokenCall).toThrow(/AOT-only/);
  });
});