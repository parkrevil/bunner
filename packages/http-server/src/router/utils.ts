import type { RouterOptions } from './types';

export function normalizePath(path: string, opts: RouterOptions): string {
  if (!path) {
    return '/';
  }
  let p = path;
  if (opts.collapseSlashes !== false) {
    // collapse multiple slashes
    p = p.replace(/\/\+/g, '/');
  }
  if (p[0] !== '/') {
    p = '/' + p;
  }
  if (opts.ignoreTrailingSlash !== false) {
    if (p.length > 1 && p.endsWith('/')) {
      p = p.slice(0, -1);
    }
  }
  return p;
}

export function splitSegments(path: string): string[] {
  if (path === '/') {
    return [];
  }
  const s = path.charCodeAt(0) === 47 ? path.slice(1) : path;
  return s.split('/');
}

export function decodeURIComponentSafe(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}
