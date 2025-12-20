import { describe, it, expect } from 'bun:test';

import { HandlerRegistry } from '../../src/router/handler-registry';

describe('HandlerRegistry', () => {
  it('should register and retrieve handlers by ID', () => {
    const registry = new HandlerRegistry();
    const handler = () => 'test';

    registry.register('test-id', handler);
    expect(registry.get('test-id')).toBe(handler);
  });

  it('should return undefined for non-existent IDs', () => {
    const registry = new HandlerRegistry();
    expect(registry.get('missing')).toBeUndefined();
  });

  it('should throw when registering duplicate ID', () => {
    const registry = new HandlerRegistry();
    const handler = () => 'test';

    registry.register('dup', handler);
    expect(() => {
      registry.register('dup', () => 'other');
    }).toThrow(/already registered/);
  });

  it('should check existence with has()', () => {
    const registry = new HandlerRegistry();
    registry.register('exist', () => {});
    expect(registry.has('exist')).toBe(true);
    expect(registry.has('none')).toBe(false);
  });

  it('should clear all handlers', () => {
    const registry = new HandlerRegistry();
    registry.register('a', () => {});
    registry.register('b', () => {});

    registry.clear();
    expect(registry.has('a')).toBe(false);
    expect(registry.has('b')).toBe(false);
  });
});