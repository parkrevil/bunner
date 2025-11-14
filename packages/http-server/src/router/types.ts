import type { RouteKey } from '../types';

export interface RouteMatch {
  key: RouteKey;
  params: Record<string, string>;
}

export interface RouterOptions {
  /** If true, treat trailing slash as equivalent ("/users" == "/users/") */
  ignoreTrailingSlash?: boolean;
  /** Collapse duplicate slashes ("//a///b" -> "/a/b") */
  collapseSlashes?: boolean;
  /** Case sensitivity for static matching (default: true) */
  caseSensitive?: boolean;
  /** Decode percent-encoded params (default: true). If false, params remain raw */
  decodeParams?: boolean;
  /** Block dot-segment traversal like '/../' and '/./' (default: true) */
  blockTraversal?: boolean;
  /** Enable LRU cache for match results (default: false) */
  enableCache?: boolean;
  /** Max entries for match LRU cache (default: 1024) */
  cacheSize?: number;
}
