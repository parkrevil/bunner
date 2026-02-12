import { join, normalize, sep } from 'path';

export interface ParsedCardKey {
  type: string;
  slug: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function assertSafeSlug(slug: string): void {
  const normalized = slug.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

  if (normalized.length === 0) {
    throw new Error('Invalid card slug: empty');
  }

  if (normalized.includes('::')) {
    throw new Error('Invalid card slug: contains ::');
  }

  const segments = normalized.split('/');
  for (const segment of segments) {
    if (segment.length === 0) {
      throw new Error('Invalid card slug: empty segment');
    }

    if (segment === '.' || segment === '..') {
      throw new Error('Invalid card slug: dot segment');
    }

    // Prevent path separator injection through normalization quirks
    if (segment.includes(sep)) {
      throw new Error('Invalid card slug: contains path separator');
    }
  }

  // Prevent Windows drive letter / absolute path semantics
  const n = normalize(normalized);
  if (n.startsWith('..') || n.startsWith(sep)) {
    throw new Error('Invalid card slug: unsafe path');
  }
}

export function normalizeSlug(slug: string): string {
  const normalized = slug.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  assertSafeSlug(normalized);
  return normalized;
}

export function buildFullKey(type: string, slug: string): string {
  const normalizedSlug = normalizeSlug(slug);
  if (!isNonEmptyString(type) || type.includes('::')) {
    throw new Error('Invalid card type');
  }
  return `${type}::${normalizedSlug}`;
}

export function parseFullKey(fullKey: string): ParsedCardKey {
  if (!isNonEmptyString(fullKey)) {
    throw new Error('Invalid card key');
  }

  const parts = fullKey.split('::');
  if (parts.length !== 2) {
    throw new Error('Invalid card key: expected {type}::{slug}');
  }

  const type = parts[0];
  const slug = parts[1];

  if (!isNonEmptyString(type) || !isNonEmptyString(slug)) {
    throw new Error('Invalid card key: missing type or slug');
  }

  return { type, slug: normalizeSlug(slug) };
}

export function assertAllowedType(type: string, allowedTypes: readonly string[]): void {
  if (!allowedTypes.includes(type)) {
    throw new Error(`Invalid card type: ${type}`);
  }
}

export function cardPathFromFullKey(projectRoot: string, fullKey: string): string {
  const parsed = parseFullKey(fullKey);
  return join(projectRoot, '.bunner', 'cards', `${parsed.slug}.card.md`);
}
