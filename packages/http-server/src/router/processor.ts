import type { EncodedSlashBehavior, NormalizedPathSegments } from './types';

export interface ProcessorConfig {
  collapseSlashes?: boolean;
  ignoreTrailingSlash?: boolean;
  blockTraversal?: boolean;
  caseSensitive?: boolean;
  maxSegmentLength?: number;
  failFastOnBadEncoding?: boolean;
}

export class Processor {
  constructor(private readonly config: ProcessorConfig) {
    if (config.failFastOnBadEncoding) {
      // console.log('Processor initialized with failFast=true');
    }
  }

  normalize(path: string, stripQuery = true): NormalizedPathSegments {
    // 1. Strip Query
    let rawPath = path;
    if (stripQuery) {
      const queryIdx = path.indexOf('?');
      if (queryIdx !== -1) {
        rawPath = path.slice(0, queryIdx);
      }
    }

    // 2. Remove Leading Slash
    let p = rawPath;
    if (p.charCodeAt(0) === 47 /* / */) {
      p = p.slice(1);
    }

    // 3. Split
    // Handle root path '/' -> p='' -> split=[''] -> pop -> []
    let segments = p.split('/');
    if (segments.length === 1 && segments[0] === '') {
      segments = [];
    }

    // 4. Dot Segment Resolution (blockTraversal = true)
    if (this.config.blockTraversal) {
      const stack: string[] = [];
      for (const seg of segments) {
        const lower = seg.toLowerCase();
        // Check for . or .. (literal or encoded)
        const isDot = lower === '.' || lower === '%2e';
        const isDotDot = lower === '..' || lower === '%2e%2e';

        if (isDot) {
          continue;
        }
        if (isDotDot) {
          if (stack.length > 0) {
            stack.pop();
          }
          continue;
        }
        stack.push(seg);
      }
      segments = stack;
    }

    // 5. Trailing Slash Handling (Post-Resolution)
    // Legacy behavior: If original path ended in '/', we might want to preserve empty segment at end?
    // But split('/') logic lost it if we stacked?
    // If rawPath ends with '/', split gives empty string at end.
    // If we resolved, we built new stack.
    // If we want to preserve trailing slash, we must check if LAST segment of SPLIT was '' (before stack).
    // Re-check expectations.
    // Normalized result usually recreates path.
    // If we ignore trailing slash, we don't care.
    // If we respect it, we might need a trailing empty segment if input had it.
    // Let's assume resolution consumes empty strings unless they are meaningful?
    // Standard path normalization removes trailing empty unless it's root.
    // But 'ignoreTrailingSlash: false' -> '/users/' != '/users'.
    // '/users/' -> segments: ['users', ''].
    // If blockTraversal is on -> segments loop. '' is not . or .. -> pushed.
    // So stack = ['users', ''].
    // It works! Empty segment preserved.

    // 6. Collapse Slashes
    if (this.config.collapseSlashes) {
      // Filter empty segments.
      // Note: This removes trailing slash too if represented as empty segment?
      // Router behavior: collapseSlashes usually means "canonicalize separators", implying no trailing slash ambiguity?
      // Test: 'should normalize duplicate slashes by default'.
      // Expect: '/multi//slash///path' -> matches key.
      // Test: 'should keep duplicate slashes when disabled'.
      // Expect: '/raw//path' -> matches key.
      // If collapseSlashes is true: filter empty.
      const result: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        if (segments[i] !== '') {
          result.push(segments[i]!);
        }
      }
      segments = result;
    } else {
      // Check ignoreTrailingSlash if collapseSlashes is FALSE.
      // If collapseSlashes is TRUE, we already removed trailing empty segment above.
      // If FALSE, we might have trailing empty segment.
      if (this.config.ignoreTrailingSlash && segments.length > 0 && segments[segments.length - 1] === '') {
        segments.pop();
      }
    }

    // 7. Case Sensitivity
    if (this.config.caseSensitive === false) {
      for (let i = 0; i < segments.length; i++) {
        segments[i] = segments[i]!.toLowerCase();
      }
    }

    // 8. Max Segment Length & Encoding Check
    const maxLen = this.config.maxSegmentLength ?? 256;
    const failFast = this.config.failFastOnBadEncoding ?? false;
    const segmentDecodeHints = new Uint8Array(segments.length);

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      if (seg.length > maxLen) {
        throw new Error(`Segment length exceeds limit: ${seg.substring(0, 20)}...`);
      }

      const hasPct = seg.indexOf('%') !== -1;
      if (hasPct) {
        segmentDecodeHints[i] = 1;
        if (failFast) {
          try {
            decodeURIComponent(seg);
          } catch (_e) {
            throw new Error(`Malformed percent encoded component: ${seg}`);
          }
        }
      }
    }

    return {
      normalized: '/' + segments.join('/'),
      segments,
      segmentDecodeHints,
      suffixPlan: undefined,
    };
  }
}

export function decodeURIComponentSafe(value: string, behavior: EncodedSlashBehavior | undefined, failFast: boolean): string {
  if (value.indexOf('%') === -1) {
    return value;
  }

  const target = value;

  if (behavior === 'reject') {
    // Check for encoded slashes (%2F or %2f)
    if (/%(2F|2f)/.test(value)) {
      throw new Error('Encoded slashes are forbidden');
    }
  } else if (behavior === 'preserve') {
    // Return raw value (per test expectation causing side-effect of not decoding other chars?)
    return value;
  }

  try {
    return decodeURIComponent(target);
  } catch (e) {
    if (failFast) {
      throw e;
    }
    return value;
  }
}
