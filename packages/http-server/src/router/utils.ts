import type { RouterOptions } from './types';

export function normalizePath(path: string, opts: RouterOptions): string {
  if (!path) {
    return '/';
  }

  const collapseSlashes = opts.collapseSlashes !== false;
  const ignoreTrailingSlash = opts.ignoreTrailingSlash !== false;
  const blockTraversal = opts.blockTraversal !== false;
  const caseSensitive = opts.caseSensitive !== false;
  const trackTrailingSlash = !ignoreTrailingSlash;

  const defaultsApplied = collapseSlashes && ignoreTrailingSlash && blockTraversal && caseSensitive;
  if (defaultsApplied && path.charCodeAt(0) === 47) {
    const trailingSlash = path.length > 1 && path.charCodeAt(path.length - 1) === 47;
    if (
      !trailingSlash &&
      path.indexOf('//') === -1 &&
      path.indexOf('/.') === -1 &&
      path.indexOf('./') === -1 &&
      path.indexOf('..') === -1
    ) {
      return path;
    }
  }

  let p = path;
  const hadTrailing = trackTrailingSlash && p.length > 1 && p.charCodeAt(p.length - 1) === 47;

  if (!caseSensitive && hasUpperCase(p)) {
    p = p.toLowerCase();
  }

  if (collapseSlashes && p.indexOf('//') !== -1) {
    p = collapseDuplicateSlashes(p);
  }

  if (p.charCodeAt(0) !== 47) {
    p = '/' + p;
  }

  const shouldStripTraversal = blockTraversal && (p.indexOf('/.') !== -1 || p.indexOf('..') !== -1 || p.indexOf('./') !== -1);
  if (shouldStripTraversal) {
    p = stripDotSegments(p, trackTrailingSlash && hadTrailing);
  } else if (trackTrailingSlash && hadTrailing && p.length > 1 && p.charCodeAt(p.length - 1) !== 47) {
    p += '/';
  }

  if (ignoreTrailingSlash && p.length > 1 && p.charCodeAt(p.length - 1) === 47) {
    p = p.slice(0, -1);
  }

  return p.length ? p : '/';
}

export function splitSegments(path: string): string[] {
  if (path === '/') {
    return [];
  }
  const s = path.charCodeAt(0) === 47 ? path.slice(1) : path;
  return s.split('/');
}

export function decodeURIComponentSafe(val: string): string {
  if (val.indexOf('%') === -1) {
    return val;
  }
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

function collapseDuplicateSlashes(value: string): string {
  let prevSlash = false;
  const out: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const ch = value.charAt(i);
    const isSlash = ch === '/';
    if (!isSlash || !prevSlash) {
      out.push(ch);
    }
    prevSlash = isSlash;
  }
  return out.join('');
}

function stripDotSegments(path: string, preserveTrailingSlash: boolean): string {
  const stack: string[] = [];
  let segmentStart = 0;
  const len = path.length;

  const pushSegment = (segment: string) => {
    if (!segment || segment === '.') {
      return;
    }
    if (segment === '..') {
      if (stack.length) {
        stack.pop();
      }
      return;
    }
    stack.push(segment);
  };

  for (let i = 1; i <= len; i++) {
    if (i === len || path.charCodeAt(i) === 47) {
      const segment = path.slice(segmentStart + 1, i);
      pushSegment(segment);
      segmentStart = i;
    }
  }

  let normalized = '/' + stack.join('/');
  if (normalized.length > 1 && preserveTrailingSlash && normalized.charCodeAt(normalized.length - 1) !== 47) {
    normalized += '/';
  }

  return normalized.length ? normalized : '/';
}

function hasUpperCase(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      return true;
    }
  }
  return false;
}
