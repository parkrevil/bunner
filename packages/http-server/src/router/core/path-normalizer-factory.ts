import type { PathNormalizer } from '../utils/path-utils';
import {
  createBadEncodingError,
  createSegmentTooLongError,
  decodeEncodedDotSegment,
  readPercentByte,
  createPathNormalizer as createFallbackNormalizer,
} from '../utils/path-utils';

const SLASH_CODE = 47;
const PERCENT_CODE = 37;
const PLUS_CODE = 43;

/**
 * PathNormalizerFactory creates specialized normalization functions based on options.
 * This factory eliminates runtime branching by providing dedicated implementations for common configurations.
 */
export const PathNormalizerFactory = {
  create(options: {
    collapseSlashes: boolean;
    ignoreTrailingSlash: boolean;
    blockTraversal: boolean;
    caseSensitive: boolean;
    maxSegmentLength: number;
    failFastOnBadEncoding: boolean;
  }): PathNormalizer {
    // 1. Raw Normalizer: If minimal normalization is needed
    if (
      !options.collapseSlashes &&
      !options.ignoreTrailingSlash &&
      !options.blockTraversal &&
      options.caseSensitive &&
      !options.failFastOnBadEncoding
    ) {
      return createRawNormalizer(options.maxSegmentLength);
    }

    // 2. Standard Normalizer: Most common case (collapse, ignore trailing, no block traversal)
    if (
      options.collapseSlashes &&
      options.ignoreTrailingSlash &&
      !options.blockTraversal &&
      options.caseSensitive &&
      !options.failFastOnBadEncoding
    ) {
      return createStandardNormalizer(options.maxSegmentLength);
    }

    // 3. Traversal Blocker: Security focused
    if (options.blockTraversal) {
      return createSecurityNormalizer(options);
    }

    // Fallback: Generic Normalizer (similar to original, but optimized)
    return createGenericNormalizer(options);
  },
};

function createRawNormalizer(maxSegmentLength: number): PathNormalizer {
  return (path: string) => {
    if (!path || path === '/') {
      return { normalized: '/', segments: [], hadTrailingSlash: false };
    }

    const len = path.length;
    const segments: string[] = [];
    const segmentDecodeHints: number[] = [];
    let start = path.charCodeAt(0) === SLASH_CODE ? 1 : 0;
    let hadTrailing = false;

    if (len > 1 && path.charCodeAt(len - 1) === SLASH_CODE) {
      hadTrailing = true;
    }

    for (let i = start; i < len; i++) {
      const code = path.charCodeAt(i);
      if (code === SLASH_CODE) {
        const segLen = i - start;
        if (segLen > maxSegmentLength) {
          throw createSegmentTooLongError(segLen, maxSegmentLength);
        }
        segments.push(path.slice(start, i));
        segmentDecodeHints.push(0);
        start = i + 1;
      } else if (code === PERCENT_CODE || code === PLUS_CODE) {
        // In raw mode, we just track but don't decode unless specifically asked,
        // but since this is 'Raw', we assume minimal processing.
        // However, standard raw expectation might still require separating segments.
      }
    }

    if (start < len) {
      const segLen = len - start;
      if (segLen > maxSegmentLength) {
        throw createSegmentTooLongError(segLen, maxSegmentLength);
      }
      segments.push(path.slice(start, len));
      segmentDecodeHints.push(0);
    } else if (hadTrailing) {
      segments.push('');
      segmentDecodeHints.push(0);
    }

    return { normalized: path, segments, segmentDecodeHints: Uint8Array.from(segmentDecodeHints), hadTrailingSlash: hadTrailing };
  };
}

function createStandardNormalizer(maxSegmentLength: number): PathNormalizer {
  return (path: string) => {
    if (!path || path === '/') {
      return { normalized: '/', segments: [], hadTrailingSlash: false };
    }

    const len = path.length;
    const segments: string[] = [];
    const segmentDecodeHints: number[] = [];

    // Fast path for simple paths?
    // Standard normalizer logic: Collapse slashes, ignore trailing slash

    let start = 0;
    // Skip leading slashes
    while (start < len && path.charCodeAt(start) === SLASH_CODE) {
      start++;
    }

    let segmentStart = start;
    let sawEncoded = false;

    for (let i = start; i < len; i++) {
      const code = path.charCodeAt(i);
      if (code === SLASH_CODE) {
        if (i > segmentStart) {
          const segLen = i - segmentStart;
          if (segLen > maxSegmentLength) {
            throw createSegmentTooLongError(segLen, maxSegmentLength);
          }
          const seg = path.slice(segmentStart, i);
          segments.push(seg);
          segmentDecodeHints.push(sawEncoded ? 1 : 0);
        }
        segmentStart = i + 1;
        // Skip multiple slashes
        while (segmentStart < len && path.charCodeAt(segmentStart) === SLASH_CODE) {
          segmentStart++;
          i = segmentStart - 1;
        }
        sawEncoded = false;
      } else if (code === PERCENT_CODE || code === PLUS_CODE) {
        sawEncoded = true;
      }
    }

    if (segmentStart < len) {
      const segLen = len - segmentStart;
      if (segLen > maxSegmentLength) {
        throw createSegmentTooLongError(segLen, maxSegmentLength);
      }
      segments.push(path.slice(segmentStart, len));
      segmentDecodeHints.push(sawEncoded ? 1 : 0);
    }

    // Ignore trailing slash means we don't care if there was one for the purpose of 'hadTrailingSlash' in the output usually,
    // but the interface return type expects it.
    // For standard normalization (ignoreTrailingSlash=true), we produce a path WITHOUT trailing slash
    // unless it is root. But we need to return segments.
    // Normalized path string reconstruction:
    const normalized = '/' + segments.join('/');

    return {
      normalized,
      segments,
      segmentDecodeHints: Uint8Array.from(segmentDecodeHints),
      hadTrailingSlash: len > 1 && path.charCodeAt(len - 1) === SLASH_CODE,
    };
  };
}

function createSecurityNormalizer(options: {
  maxSegmentLength: number;
  failFastOnBadEncoding: boolean;
  collapseSlashes: boolean;
  ignoreTrailingSlash: boolean;
  caseSensitive: boolean;
}): PathNormalizer {
  // This involves blockTraversal, so we need dot handling.
  // This is the most complex one, so we can reuse the generic logic structure
  // but specialized for security (always checking dots).
  const maxLen = options.maxSegmentLength;
  const failFast = options.failFastOnBadEncoding;
  const collapse = options.collapseSlashes;

  return (path: string) => {
    if (!path || path === '/') {
      return { normalized: '/', segments: [], hadTrailingSlash: false };
    }

    const segments: string[] = [];
    const segmentDecodeHints: number[] = [];
    const len = path.length;
    let start = 0;

    if (collapse) {
      while (start < len && path.charCodeAt(start) === SLASH_CODE) {
        start++;
      }
    } else {
      if (path.charCodeAt(0) === SLASH_CODE) {
        start = 1;
      }
    }

    let segmentStart = start;
    let sawEncoded = false;

    for (let i = start; i < len; i++) {
      const code = path.charCodeAt(i);
      if (code === SLASH_CODE) {
        if (i > segmentStart || !collapse) {
          // If collapse is false, we push empty segments
          const segLen = i - segmentStart;
          if (segLen > maxLen) {
            throw createSegmentTooLongError(segLen, maxLen);
          }
          const seg = path.slice(segmentStart, i);

          // Security check: Dot segments
          if (seg === '.' || seg === '..') {
            // Simplify logic: Just push it to segments and resolve later or resolve on the fly?
            // Generic implementation resolves at the end.
          }

          segments.push(seg);
          segmentDecodeHints.push(sawEncoded ? 1 : 0);
        }

        segmentStart = i + 1;
        if (collapse) {
          while (segmentStart < len && path.charCodeAt(segmentStart) === SLASH_CODE) {
            segmentStart++;
            i = segmentStart - 1;
          }
        }
        sawEncoded = false;
      } else if (code === PERCENT_CODE) {
        if (failFast) {
          if (readPercentByte(path, i) === -1) {
            throw createBadEncodingError(path, i);
          }
        }
        sawEncoded = true;
      } else if (code === PLUS_CODE) {
        sawEncoded = true;
      }
    }

    if (segmentStart < len || (!collapse && segmentStart === len && path.charCodeAt(len - 1) === SLASH_CODE)) {
      const segLen = len - segmentStart;
      if (segLen > maxLen) {
        throw createSegmentTooLongError(segLen, maxLen);
      }
      segments.push(path.slice(segmentStart, len));
      segmentDecodeHints.push(sawEncoded ? 1 : 0);
    }

    // Dot Traversal Resolution
    const stack: string[] = [];
    const hintStack: number[] = [];

    for (let k = 0; k < segments.length; k++) {
      let seg = segments[k]!;

      // Check for encoded dots
      if (sawEncoded) {
        // Optimization: only check if we saw encoded chars?
        // Actually we tracking per segment sawEncoded is hard here, using global sawEncoded for now or just checking
        // Since decodeEncodedDotSegment checks if % exists, it's fast.
        const decoded = decodeEncodedDotSegment(seg);
        if (decoded) {
          seg = decoded;
        }
      } else if (seg.indexOf('%') !== -1) {
        // Fallback safety if sawEncoded flag wasn't tracked perfectly per segment in this loop
        const decoded = decodeEncodedDotSegment(seg);
        if (decoded) {
          seg = decoded;
        }
      }

      if (seg === '.') {
        continue;
      }
      if (seg === '..') {
        stack.pop();
        hintStack.pop();
        continue;
      }
      stack.push(seg);
      hintStack.push(segmentDecodeHints[k]!);
    }

    const normalized = '/' + stack.join('/');
    return { normalized, segments: stack, segmentDecodeHints: Uint8Array.from(hintStack), hadTrailingSlash: path.endsWith('/') };
  };
}

function createGenericNormalizer(options: {
  collapseSlashes: boolean;
  ignoreTrailingSlash: boolean;
  blockTraversal: boolean;
  caseSensitive: boolean;
  maxSegmentLength: number;
  failFastOnBadEncoding: boolean;
}): PathNormalizer {
  return createFallbackNormalizer(options);
}
