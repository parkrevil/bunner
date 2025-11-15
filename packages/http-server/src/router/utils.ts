import type { RouterOptions } from './types';

export interface NormalizedPathSegments {
  normalized: string;
  segments: string[];
}

export function normalizeAndSplit(path: string, opts: RouterOptions): NormalizedPathSegments {
  if (!path || path === '/') {
    return { normalized: '/', segments: [] };
  }

  const collapseSlashes = opts.collapseSlashes !== false;
  const ignoreTrailingSlash = opts.ignoreTrailingSlash !== false;
  const blockTraversal = opts.blockTraversal !== false;
  const caseSensitive = opts.caseSensitive !== false;
  const trackTrailingSlash = !ignoreTrailingSlash;
  const hadTrailing = trackTrailingSlash && path.length > 1 && path.charCodeAt(path.length - 1) === 47;

  const hasLeadingSlash = path.charCodeAt(0) === 47;
  const startIndex = hasLeadingSlash ? 1 : 0;

  const segments: string[] = [];
  let allowEmpty = hasLeadingSlash;
  let segmentStart = startIndex;
  let sawChar = false;
  let needsDotHandling = false;
  let segmentSawUpper = false;

  const pushSegment = (endIdx: number) => {
    if (endIdx > segmentStart) {
      let part = path.slice(segmentStart, endIdx);
      if (!caseSensitive && segmentSawUpper) {
        part = part.toLowerCase();
      }
      segments.push(part);
      if (blockTraversal && (part === '.' || part === '..')) {
        needsDotHandling = true;
      }
      allowEmpty = true;
    } else if (!collapseSlashes && allowEmpty) {
      segments.push('');
      allowEmpty = true;
    }
    segmentStart = endIdx + 1;
    segmentSawUpper = false;
  };

  for (let i = startIndex; i < path.length; i++) {
    sawChar = true;
    const code = path.charCodeAt(i);
    if (code === 47) {
      pushSegment(i);
      continue;
    }
    if (!caseSensitive && code >= 65 && code <= 90) {
      segmentSawUpper = true;
    }
    allowEmpty = false;
  }

  if (segmentStart < path.length) {
    pushSegment(path.length);
  } else if (!collapseSlashes && allowEmpty && sawChar) {
    segments.push('');
  }

  let normalizedSegments = segments;
  if (blockTraversal && needsDotHandling) {
    const stack: string[] = [];
    for (const part of segments) {
      if (!part || part === '.') {
        continue;
      }
      if (part === '..') {
        if (stack.length) {
          stack.pop();
        }
        continue;
      }
      stack.push(part);
    }
    normalizedSegments = stack;
  }

  let normalized = normalizedSegments.length ? '/' + normalizedSegments.join('/') : '/';
  if (ignoreTrailingSlash && normalized.length > 1 && normalized.charCodeAt(normalized.length - 1) === 47) {
    normalized = normalized.slice(0, -1);
  } else if (trackTrailingSlash && hadTrailing && normalized.length > 1 && normalized.charCodeAt(normalized.length - 1) !== 47) {
    normalized += '/';
  }

  let matchSegments = normalizedSegments;
  if (normalized.length > 1 && normalized.charCodeAt(normalized.length - 1) === 47) {
    matchSegments = [...normalizedSegments, ''];
  }

  return {
    normalized: normalized.length ? normalized : '/',
    segments: matchSegments,
  };
}

export function normalizePath(path: string, opts: RouterOptions): string {
  return normalizeAndSplit(path, opts).normalized;
}

export function splitSegments(path: string): string[] {
  if (path === '/') {
    return [];
  }

  const hasLeadingSlash = path.charCodeAt(0) === 47;
  const startIndex = hasLeadingSlash ? 1 : 0;
  const segments: string[] = [];
  let segment = '';
  let allowEmpty = hasLeadingSlash;
  let sawChar = false;

  for (let i = startIndex; i < path.length; i++) {
    sawChar = true;
    const code = path.charCodeAt(i);
    if (code === 47) {
      if (segment.length) {
        segments.push(segment);
        segment = '';
      } else if (allowEmpty) {
        segments.push('');
      }
      allowEmpty = true;
      continue;
    }

    segment += String.fromCharCode(code);
    allowEmpty = false;
  }

  if (segment.length) {
    segments.push(segment);
  } else if (allowEmpty && sawChar && (segments.length || hasLeadingSlash)) {
    segments.push('');
  }

  return segments;
}

export function decodeURIComponentSafe(val: string): string {
  const firstPercent = val.indexOf('%');
  if (firstPercent === -1) {
    return val;
  }
  const asciiDecoded = decodeAsciiPercents(val, firstPercent);
  if (asciiDecoded !== null) {
    return asciiDecoded;
  }
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
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
