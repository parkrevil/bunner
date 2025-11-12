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
}
