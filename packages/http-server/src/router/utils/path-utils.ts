import { TextDecoder, TextEncoder } from 'node:util';

import { sanitizeMaxSegmentLength } from '../core/router-options';
import type { EncodedSlashBehavior, NormalizedPathSegments, RouterOptions } from '../types';

export interface PathNormalizerConfig {
  ignoreTrailingSlash: boolean;
  collapseSlashes: boolean;
  blockTraversal: boolean;
  caseSensitive: boolean;
  failFastOnBadEncoding: boolean;
  maxSegmentLength: number;
}

export type PathNormalizer = (path: string) => NormalizedPathSegments;

const SLASH_CODE = 47;
const DOT_CODE = 46;
const PERCENT_CODE = 37;
const PLUS_CODE = 43;
const UPPER_A = 65;
const UPPER_Z = 90;
const pathNormalizerCache = new Map<number, PathNormalizer>();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SHORT_LOWER_THRESHOLD = 64;

export function createPathNormalizer(config: PathNormalizerConfig): PathNormalizer {
  const collapseSlashes = Boolean(config.collapseSlashes);
  const ignoreTrailingSlash = Boolean(config.ignoreTrailingSlash);
  const blockTraversal = Boolean(config.blockTraversal);
  const caseSensitive = Boolean(config.caseSensitive);
  const failFastOnBadEncoding = Boolean(config.failFastOnBadEncoding);
  const maxSegmentLength = config.maxSegmentLength;
  const trackTrailingSlash = !ignoreTrailingSlash;
  const lowerSegment = caseSensitive ? undefined : (value: string) => lowerAsciiSimd(value);
  return (path: string): NormalizedPathSegments => {
    if (!path || path === '/') {
      return { normalized: '/', segments: [], hadTrailingSlash: false };
    }

    const simpleCandidate = collapseSlashes && path.charCodeAt(0) === SLASH_CODE;
    if (simpleCandidate) {
      const summary = scanPathSummary(path);
      const maybeSimple = trySimpleNormalization(path, summary, {
        collapseSlashes,
        blockTraversal,
        caseSensitive,
        ignoreTrailingSlash,
        trackTrailingSlash,
        lowerSegment,
        maxSegmentLength,
      });
      if (maybeSimple) {
        return maybeSimple;
      }
    }

    const hadTrailing = path.length > 1 && path.charCodeAt(path.length - 1) === SLASH_CODE;
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
      const segmentLength = endIdx - segmentStart;
      if (segmentLength > maxSegmentLength) {
        throw createSegmentTooLongError(segmentLength, maxSegmentLength);
      }
      if (segmentLength > 0) {
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
      if (code === PERCENT_CODE) {
        if (failFastOnBadEncoding && readPercentByte(path, i) === -1) {
          throw createBadEncodingError(path, i);
        }
        segmentNeedsDecoding = true;
        sawEncodedChar = true;
        continue;
      }
      if (code === PLUS_CODE) {
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

    return finalizeNormalizedSegments({
      normalizedSegments,
      normalizedHints,
      hadTrailing,
      trackTrailingSlash,
      ignoreTrailingSlash,
      sawEncodedChar,
    });
  };
}

export function normalizeAndSplit(path: string, opts: RouterOptions): NormalizedPathSegments {
  const config: PathNormalizerConfig = {
    ignoreTrailingSlash: opts.ignoreTrailingSlash ?? true,
    collapseSlashes: opts.collapseSlashes ?? true,
    blockTraversal: opts.blockTraversal ?? true,
    caseSensitive: opts.caseSensitive ?? true,
    failFastOnBadEncoding: opts.failFastOnBadEncoding ?? false,
    maxSegmentLength: sanitizeMaxSegmentLength(opts.maxSegmentLength),
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
  let key = (config.maxSegmentLength & 0xffff) << 5;
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
  if (config.failFastOnBadEncoding) {
    key |= 1 << 4;
  }
  return key;
}

export function lowerAsciiSimd(value: string): string {
  if (!value) {
    return value;
  }
  if (value.length <= SHORT_LOWER_THRESHOLD) {
    const lowered = lowerAsciiFast(value);
    if (lowered !== null) {
      return lowered;
    }
  }
  return lowerAsciiWithEncoder(value);
}

function lowerAsciiFast(value: string): string | null {
  let mutated = false;
  let result = '';
  let lastPos = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0x7f) {
      return null;
    }
    if (code >= UPPER_A && code <= UPPER_Z) {
      if (!mutated) {
        result = value.slice(0, i);
        mutated = true;
      } else if (lastPos < i) {
        result += value.slice(lastPos, i);
      }
      result += String.fromCharCode(code | 0x20);
      lastPos = i + 1;
    }
  }
  if (!mutated) {
    return value;
  }
  if (lastPos < value.length) {
    result += value.slice(lastPos);
  }
  return result;
}

function lowerAsciiWithEncoder(value: string): string {
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

export function decodeURIComponentSafe(
  val: string,
  slashBehavior: EncodedSlashBehavior = 'decode',
  failFastOnBadEncoding = false,
): string {
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
  const asciiDecoded = decodeAsciiPercents(input, firstPercent, failFastOnBadEncoding);
  if (asciiDecoded !== null) {
    return asciiDecoded;
  }
  try {
    return decodeURIComponent(input);
  } catch {
    if (failFastOnBadEncoding) {
      throw createBadEncodingError(input);
    }
    return input;
  }
}

function decodeAsciiPercents(value: string, startIdx: number, failFastOnBadEncoding: boolean): string | null {
  const chunks: string[] = [];
  let lastPos = 0;
  for (let i = startIdx; i < value.length; i++) {
    if (value.charCodeAt(i) !== PERCENT_CODE) {
      continue;
    }
    const byte = readPercentByte(value, i);
    if (byte === -1) {
      if (failFastOnBadEncoding) {
        throw createBadEncodingError(value, i);
      }
      return null;
    }
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
  if (!part || part.indexOf('%') === -1 || !containsEncodedDot(part)) {
    return null;
  }
  const normalized = part.replace(/%2e/gi, '.');
  if (normalized === '.' || normalized === '..') {
    return normalized;
  }
  return null;
}

function containsEncodedDot(value: string): boolean {
  for (let i = 0; i < value.length - 2; i++) {
    if (value.charCodeAt(i) !== PERCENT_CODE) {
      continue;
    }
    const hi = value.charCodeAt(i + 1) | 0x20;
    const lo = value.charCodeAt(i + 2) | 0x20;
    if (hi === 0x32 && lo === 0x65) {
      return true;
    }
  }
  return false;
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

function readPercentByte(value: string, index: number): number {
  if (index + 2 >= value.length) {
    return -1;
  }
  const hi = fromHex(value.charCodeAt(index + 1));
  const lo = fromHex(value.charCodeAt(index + 2));
  if (hi === -1 || lo === -1) {
    return -1;
  }
  return (hi << 4) | lo;
}

const MAX_SNIPPET_LENGTH = 48;

function createBadEncodingError(value: string, index?: number): RangeError {
  const snippet = formatSnippet(value);
  const context = typeof index === 'number' ? `near offset ${index}` : 'in path';
  return captureRouterErrorStack(new RangeError(`Malformed percent-encoding ${context}: ${snippet}`), createBadEncodingError);
}

function createSegmentTooLongError(length: number, limit: number): RangeError {
  return captureRouterErrorStack(
    new RangeError(`Path segment length ${length} exceeds configured max ${limit}`),
    createSegmentTooLongError,
  );
}

function formatSnippet(value: string): string {
  if (!value) {
    return '<empty>';
  }
  return value.length <= MAX_SNIPPET_LENGTH ? value : value.slice(0, MAX_SNIPPET_LENGTH) + '...';
}

function captureRouterErrorStack<T extends Error>(error: T, ctor: Function): T {
  if (typeof Error.captureStackTrace === 'function') {
    Error.captureStackTrace(error, ctor);
  }
  return error;
}

interface PathScanSummary {
  hasLeadingSlash: boolean;
  hasTrailingSlash: boolean;
  hasDuplicateSlash: boolean;
  hasEncodedChar: boolean;
  hasPlusChar: boolean;
  hasDotChar: boolean;
  hasUppercase: boolean;
}

interface SimpleNormalizationConfig {
  collapseSlashes: boolean;
  blockTraversal: boolean;
  caseSensitive: boolean;
  ignoreTrailingSlash: boolean;
  trackTrailingSlash: boolean;
  lowerSegment?: (value: string) => string;
  maxSegmentLength: number;
}

interface FinalizeArgs {
  normalizedSegments: string[];
  normalizedHints: number[];
  hadTrailing: boolean;
  trackTrailingSlash: boolean;
  ignoreTrailingSlash: boolean;
  sawEncodedChar: boolean;
}

function scanPathSummary(path: string): PathScanSummary {
  const len = path.length;
  if (!len) {
    return {
      hasLeadingSlash: false,
      hasTrailingSlash: false,
      hasDuplicateSlash: false,
      hasEncodedChar: false,
      hasPlusChar: false,
      hasDotChar: false,
      hasUppercase: false,
    };
  }
  const hasLeadingSlash = path.charCodeAt(0) === SLASH_CODE;
  const hasTrailingSlash = len > 1 && path.charCodeAt(len - 1) === SLASH_CODE;
  let hasDuplicateSlash = false;
  let hasEncodedChar = false;
  let hasPlusChar = false;
  let hasDotChar = false;
  let hasUppercase = false;
  let prevWasSlash = false;
  for (let i = 0; i < len; i++) {
    const code = path.charCodeAt(i);
    if (code === SLASH_CODE) {
      if (prevWasSlash) {
        hasDuplicateSlash = true;
      }
      prevWasSlash = true;
      continue;
    }
    prevWasSlash = false;
    if (code === PERCENT_CODE) {
      hasEncodedChar = true;
      continue;
    }
    if (code === PLUS_CODE) {
      hasPlusChar = true;
      continue;
    }
    if (code === DOT_CODE) {
      hasDotChar = true;
      continue;
    }
    if (code >= UPPER_A && code <= UPPER_Z) {
      hasUppercase = true;
    }
  }
  return {
    hasLeadingSlash,
    hasTrailingSlash,
    hasDuplicateSlash,
    hasEncodedChar,
    hasPlusChar,
    hasDotChar,
    hasUppercase,
  };
}

function trySimpleNormalization(
  path: string,
  summary: PathScanSummary,
  config: SimpleNormalizationConfig,
): NormalizedPathSegments | undefined {
  if (!summary.hasLeadingSlash) {
    return undefined;
  }
  if (!config.collapseSlashes || summary.hasDuplicateSlash) {
    return undefined;
  }
  if (summary.hasEncodedChar || summary.hasPlusChar) {
    return undefined;
  }
  if (config.blockTraversal && summary.hasDotChar) {
    return undefined;
  }

  let workingPath = path;
  if (!config.caseSensitive && summary.hasUppercase && config.lowerSegment) {
    workingPath = lowerAsciiSimd(path);
  }

  const segments: string[] = [];
  let segmentStart = 1;
  for (let i = 1; i < workingPath.length; i++) {
    if (workingPath.charCodeAt(i) === SLASH_CODE) {
      if (i > segmentStart) {
        const segmentLength = i - segmentStart;
        if (segmentLength > config.maxSegmentLength) {
          throw createSegmentTooLongError(segmentLength, config.maxSegmentLength);
        }
        const part = workingPath.slice(segmentStart, i);
        segments.push(part);
      }
      segmentStart = i + 1;
    }
  }
  if (segmentStart < workingPath.length) {
    const segmentLength = workingPath.length - segmentStart;
    if (segmentLength > config.maxSegmentLength) {
      throw createSegmentTooLongError(segmentLength, config.maxSegmentLength);
    }
    const last = workingPath.slice(segmentStart);
    segments.push(last);
  }

  const hints = segments.length ? new Array<number>(segments.length).fill(0) : [];
  return finalizeNormalizedSegments({
    normalizedSegments: segments,
    normalizedHints: hints,
    hadTrailing: summary.hasTrailingSlash,
    trackTrailingSlash: config.trackTrailingSlash,
    ignoreTrailingSlash: config.ignoreTrailingSlash,
    sawEncodedChar: false,
  });
}

function finalizeNormalizedSegments(args: FinalizeArgs): NormalizedPathSegments {
  const { normalizedSegments, normalizedHints, hadTrailing, trackTrailingSlash, ignoreTrailingSlash, sawEncodedChar } = args;
  let normalized = normalizedSegments.length ? '/' + normalizedSegments.join('/') : '/';
  let endsWithSlash = normalized.length > 1 && normalized.charCodeAt(normalized.length - 1) === SLASH_CODE;
  if (ignoreTrailingSlash && endsWithSlash) {
    normalized = normalized.slice(0, -1);
    endsWithSlash = false;
  } else if (trackTrailingSlash && hadTrailing && normalized.length > 1 && !endsWithSlash) {
    normalized += '/';
    endsWithSlash = true;
  }

  let matchSegments = normalizedSegments;
  let matchHints = normalizedHints;
  if (endsWithSlash) {
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
    hadTrailingSlash: hadTrailing,
  };
}
