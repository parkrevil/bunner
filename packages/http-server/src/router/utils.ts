import type { RouterOptions } from './types';

export function normalizePath(path: string, opts: RouterOptions): string {
  if (!path) {
    return '/';
  }
  let p = path;
  if (opts.collapseSlashes !== false) {
    // collapse multiple slashes
    p = p.replace(/\/+/g, '/');
  }
  if (p[0] !== '/') {
    p = '/' + p;
  }
  // Remove dot-segments when blocking traversal
  if (opts.blockTraversal !== false) {
    const parts = p.split('/');
    const stack: string[] = [];
    for (const part of parts) {
      if (part === '' || part === '.') {
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
    p = '/' + stack.join('/');
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
