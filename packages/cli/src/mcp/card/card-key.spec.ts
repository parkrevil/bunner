import { describe, expect, it } from 'bun:test';

import { buildFullKey, cardPathFromFullKey, normalizeSlug, parseFullKey } from './card-key';

describe('mcp/card — card key', () => {
  it('normalizes slug by trimming slashes and backslashes', () => {
    expect(normalizeSlug('/auth/login/')).toBe('auth/login');
    expect(normalizeSlug('auth\\login')).toBe('auth/login');
  });

  it('rejects unsafe slugs', () => {
    expect(() => normalizeSlug('')).toThrow();
    expect(() => normalizeSlug('../x')).toThrow();
    expect(() => normalizeSlug('a/../b')).toThrow();
    expect(() => normalizeSlug('./a')).toThrow();
    expect(() => normalizeSlug('a//b')).toThrow();
    expect(() => normalizeSlug('a::b')).toThrow();
  });

  it('builds and parses full keys', () => {
    const key = buildFullKey('spec', 'auth/login');
    expect(key).toBe('spec::auth/login');

    const parsed = parseFullKey('spec::auth/login');
    expect(parsed).toEqual({ type: 'spec', slug: 'auth/login' });
  });

  it('rejects invalid full keys', () => {
    expect(() => parseFullKey('')).toThrow();
    expect(() => parseFullKey('spec')).toThrow();
    expect(() => parseFullKey('spec::')).toThrow();
    expect(() => parseFullKey('::auth/login')).toThrow();
    expect(() => parseFullKey('a::b::c')).toThrow();
  });

  it('maps fullKey to .bunner/cards path', () => {
    const root = '/repo';
    expect(cardPathFromFullKey(root, 'spec::auth/login')).toBe('/repo/.bunner/cards/auth/login.card.md');
    expect(cardPathFromFullKey(root, 'spec::auth')).toBe('/repo/.bunner/cards/auth.card.md');
  });
});
