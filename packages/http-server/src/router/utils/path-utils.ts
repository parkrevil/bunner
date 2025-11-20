import { TextDecoder, TextEncoder } from 'node:util';

import type { EncodedSlashBehavior, NormalizedPathSegments, RouterOptions } from '../types';

export interface PathNormalizerConfig {
  ignoreTrailingSlash: boolean;
  collapseSlashes: boolean;
  blockTraversal: boolean;
  caseSensitive: boolean;
}

export type PathNormalizer = (path: string) => NormalizedPathSegments;

const SLASH_CODE = 47;
const UPPER_A = 65;
const UPPER_Z = 90;
const pathNormalizerCache = new Map<number, PathNormalizer>();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function createPathNormalizer(config: PathNormalizerConfig): PathNormalizer {
  const collapseSlashes = Boolean(config.collapseSlashes);
  const ignoreTrailingSlash = Boolean(config.ignoreTrailingSlash);
  const blockTraversal = Boolean(config.blockTraversal);
  const caseSensitive = Boolean(config.caseSensitive);
  const trackTrailingSlash = !ignoreTrailingSlash;
  const lowerSegment = caseSensitive ? undefined : (value: string) => lowerAsciiSimd(value);

  return (path: string): NormalizedPathSegments => {
    if (!path || path === '/') {
      return { normalized: '/', segments: [] };
    }

    const hadTrailing = trackTrailingSlash && path.length > 1 && path.charCodeAt(path.length - 1) === SLASH_CODE;
    const hasLeadingSlash = path.charCodeAt(0) === SLASH_CODE;
    const startIndex = hasLeadingSlash ? 1 : 0;
    const segments: string[] = [];
    const segmentDecodeHints: number[] = [];
    let allowEmpty = hasLeadingSlash;
    let segmentStart = startIndex;
    let sawChar = false;
    let needsDotHandling = false;
    let segmentSawUpper = false;
    let segmentNeedsDecoding = false;
    let sawEncodedChar = false;

    const pushSegment = (endIdx: number): void => {
      if (endIdx > segmentStart) {
        let part = path.slice(segmentStart, endIdx);
        if (blockTraversal) {
          const decodedDot = decodeEncodedDotSegment(part);
          if (decodedDot) {
            part = decodedDot;
          }
        }
        if (!caseSensitive && segmentSawUpper && lowerSegment) {
          part = lowerSegment(part);
        }
        segments.push(part);
        segmentDecodeHints.push(segmentNeedsDecoding ? 1 : 0);
        if (blockTraversal && (part === '.' || part === '..')) {
          needsDotHandling = true;
        }
        allowEmpty = true;
      } else if (!collapseSlashes && allowEmpty) {
        segments.push('');
        segmentDecodeHints.push(0);
        allowEmpty = true;
      }
      segmentStart = endIdx + 1;
      segmentSawUpper = false;
      segmentNeedsDecoding = false;
    };

    for (let i = startIndex; i < path.length; i++) {
      sawChar = true;
      const code = path.charCodeAt(i);
      if (code === SLASH_CODE) {
        pushSegment(i);
        continue;
      }
      if (!caseSensitive && code >= UPPER_A && code <= UPPER_Z) {
        segmentSawUpper = true;
      }
      if (code === 37 /* '%' */ || code === 43 /* '+' */) {
        segmentNeedsDecoding = true;
        sawEncodedChar = true;
      }
      allowEmpty = false;
    }

    if (segmentStart < path.length) {
      pushSegment(path.length);
    } else if (!collapseSlashes && allowEmpty && sawChar) {
      segments.push('');
      segmentDecodeHints.push(0);
    }

    let normalizedSegments = segments;
    let normalizedHints = segmentDecodeHints;
    if (blockTraversal && needsDotHandling) {
      const stack: string[] = [];
      const hintStack: number[] = [];
      for (let idx = 0; idx < segments.length; idx++) {
        const part = segments[idx]!;
        const hint = segmentDecodeHints[idx] ?? 0;
        if (!part || part === '.') {
          continue;
        }
        if (part === '..') {
          if (stack.length) {
            stack.pop();
            hintStack.pop();
          }
          continue;
        }
        stack.push(part);
        hintStack.push(hint);
      }
      normalizedSegments = stack;
      normalizedHints = hintStack;
    }

    let normalized = normalizedSegments.length ? '/' + normalizedSegments.join('/') : '/';
    if (ignoreTrailingSlash && normalized.length > 1 && normalized.charCodeAt(normalized.length - 1) === SLASH_CODE) {
      normalized = normalized.slice(0, -1);
    } else if (
      trackTrailingSlash &&
      hadTrailing &&
      normalized.length > 1 &&
      normalized.charCodeAt(normalized.length - 1) !== SLASH_CODE
    ) {
      normalized += '/';
    }

    let matchSegments = normalizedSegments;
    let matchHints = normalizedHints;
    if (normalized.length > 1 && normalized.charCodeAt(normalized.length - 1) === SLASH_CODE) {
      matchSegments = [...normalizedSegments, ''];
      matchHints = [...normalizedHints, 0];
    }

    const suffixSource = normalized.length > 1 && normalized.charCodeAt(0) === SLASH_CODE ? normalized.slice(1) : normalized;
    const segmentOffsets = computeSegmentOffsets(matchSegments);
    let decodeHintsArray: Uint8Array | undefined;
    if (sawEncodedChar && matchHints.length) {
      let hasHints = false;
      for (let i = 0; i < matchHints.length; i++) {
        if (matchHints[i]) {
          hasHints = true;
          break;
        }
      }
      if (hasHints) {
        decodeHintsArray = Uint8Array.from(matchHints);
      }
    }

    return {
      normalized: normalized.length ? normalized : '/',
      segments: matchSegments,
      segmentOffsets,
      segmentDecodeHints: decodeHintsArray,
      suffixSource,
    };
  };
}

export function normalizeAndSplit(path: string, opts: RouterOptions): NormalizedPathSegments {
  const config: PathNormalizerConfig = {
    ignoreTrailingSlash: opts.ignoreTrailingSlash ?? true,
    collapseSlashes: opts.collapseSlashes ?? true,
    blockTraversal: opts.blockTraversal ?? true,
    caseSensitive: opts.caseSensitive ?? true,
  };
  const cacheKey = buildCacheKey(config);
  let normalizer = pathNormalizerCache.get(cacheKey);
  if (!normalizer) {
    normalizer = createPathNormalizer(config);
    pathNormalizerCache.set(cacheKey, normalizer);
  }
  return normalizer(path);
}

export function computeSegmentOffsets(segments: readonly string[]): Uint32Array {
  const offsets = new Uint32Array(segments.length + 1);
  let cursor = 0;
  for (let i = 0; i < segments.length; i++) {
    offsets[i] = cursor;
    cursor += segments[i]!.length;
    if (i !== segments.length - 1) {
      cursor++;
    }
  }
  offsets[segments.length] = cursor;
  return offsets;
}

export function ensureSegmentOffsets(prepared: NormalizedPathSegments): Uint32Array {
  const segments = prepared.segments;
  if (prepared.segmentOffsets && prepared.segmentOffsets.length === segments.length + 1) {
    return prepared.segmentOffsets;
  }
  const offsets = computeSegmentOffsets(segments);
  prepared.segmentOffsets = offsets;
  return offsets;
}

export function ensureSuffixSlices(prepared: NormalizedPathSegments, offsets: Uint32Array, source: string): string[] {
  const expectedLength = offsets.length;
  if (prepared.suffixSlices && prepared.suffixSlices.length === expectedLength) {
    return prepared.suffixSlices;
  }
  const slices = new Array<string>(expectedLength);
  for (let i = 0; i < expectedLength; i++) {
    slices[i] = source.slice(offsets[i]);
  }
  prepared.suffixSlices = slices;
  return slices;
}

function buildCacheKey(config: PathNormalizerConfig): number {
  let key = 0;
  if (config.ignoreTrailingSlash) {
    key |= 1 << 0;
  }
  if (config.collapseSlashes) {
    key |= 1 << 1;
  }
  if (config.blockTraversal) {
    key |= 1 << 2;
  }
  if (config.caseSensitive) {
    key |= 1 << 3;
  }
  return key;
}

export function lowerAsciiSimd(value: string): string {
  const bytes = encoder.encode(value);
  let mutated = false;
  const len = bytes.length;
  const chunkSize = 16;
  let index = 0;
  while (index + chunkSize <= len) {
    mutated = processChunk(bytes, index, chunkSize) || mutated;
    index += chunkSize;
  }
  for (; index < len; index++) {
    mutated = lowerByte(bytes, index) || mutated;
  }
  return mutated ? decoder.decode(bytes) : value;
}

function processChunk(bytes: Uint8Array, start: number, count: number): boolean {
  let mutated = false;
  const end = start + count;
  for (let i = start; i < end; i++) {
    mutated = lowerByte(bytes, i) || mutated;
  }
  return mutated;
}

function lowerByte(bytes: Uint8Array, index: number): boolean {
  const code = bytes[index]!;
  if (code >= UPPER_A && code <= UPPER_Z) {
    bytes[index] = code | 0x20;
    return true;
  }
  return false;
}

const ENCODED_SLASH_PATTERN = /%(?:2f|5c)/i;

export function decodeURIComponentSafe(val: string, slashBehavior: EncodedSlashBehavior = 'decode'): string {
  let input = val;
  if (slashBehavior === 'preserve' && input.length) {
    input = input.replace(/%2f/gi, '%252F').replace(/%5c/gi, '%255C');
  } else if (slashBehavior === 'reject' && ENCODED_SLASH_PATTERN.test(input)) {
    throw new Error('Encoded slash sequences (%2F or %5C) are not allowed in this router configuration');
  }
  const firstPercent = input.indexOf('%');
  if (firstPercent === -1) {
    return input;
  }
  const asciiDecoded = decodeAsciiPercents(input, firstPercent);
  if (asciiDecoded !== null) {
    return asciiDecoded;
  }
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function decodeAsciiPercents(value: string, startIdx: number): string | null {
  const chunks: string[] = [];
  let lastPos = 0;
  for (let i = startIdx; i < value.length; i++) {
    if (value.charCodeAt(i) !== 37 /* % */) {
      continue;
    }
    if (i + 2 >= value.length) {
      return null;
    }
    const hi = fromHex(value.charCodeAt(i + 1));
    const lo = fromHex(value.charCodeAt(i + 2));
    if (hi === -1 || lo === -1) {
      return null;
    }
    const byte = (hi << 4) | lo;
    if (byte >= 0x80) {
      return null;
    }
    if (i > lastPos) {
      chunks.push(value.slice(lastPos, i));
    }
    chunks.push(String.fromCharCode(byte));
    i += 2;
    lastPos = i + 1;
  }
  if (!chunks.length) {
    return null;
  }
  if (lastPos < value.length) {
    chunks.push(value.slice(lastPos));
  }
  return chunks.join('');
}

function decodeEncodedDotSegment(part: string): string | null {
  if (!part || part.indexOf('%') === -1) {
    return null;
  }
  const normalized = part.replace(/%2e/gi, '.');
  if (normalized === '.' || normalized === '..') {
    return normalized;
  }
  return null;
}

function fromHex(code: number): number {
  if (code >= 48 && code <= 57) {
    return code - 48;
  }
  if (code >= 65 && code <= 70) {
    return code - 55;
  }
  if (code >= 97 && code <= 102) {
    return code - 87;
  }
  return -1;
}
