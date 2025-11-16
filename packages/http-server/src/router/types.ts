import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import type { ImmutableRouterLayout } from './immutable-layout';

export type PatternTesterFn = (value: string) => boolean;

export type EncodedSlashBehavior = 'decode' | 'preserve' | 'reject';

export interface NormalizedPathSegments {
  normalized: string;
  segments: string[];
}

export interface RouteMatch {
  key: RouteKey;
  params: Record<string, string>;
}

export type StaticProbeResult =
  | { kind: 'hit'; match: RouteMatch }
  | { kind: 'static-miss'; normalized: string }
  | { kind: 'fallback'; prepared?: NormalizedPathSegments };

export interface DynamicMatcherConfig {
  method: HttpMethod;
  segments: string[];
  decodeParams: boolean;
  hasWildcardRoutes: boolean;
  captureSnapshot: boolean;
  suffixSource?: string;
  layout: ImmutableRouterLayout;
  patternTesters: ReadonlyArray<PatternTesterFn | undefined>;
  paramOrders?: ReadonlyArray<Uint16Array | null>;
  observer?: MatchObserverHooks;
  encodedSlashBehavior: EncodedSlashBehavior;
}

export interface MatchObserverHooks {
  onParamBranch?: (nodeIndex: number, localOffset: number) => void;
}

export interface DynamicMatchResult {
  key: RouteKey;
  params: Record<string, string>;
  snapshot?: Array<[string, string]>;
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
  /** Keep %2F sequences encoded instead of decoding to '/' */
  preserveEncodedSlashes?: boolean;
  /** Fine-grained control over how encoded slash ("/" or "\\") sequences are handled in params */
  encodedSlashBehavior?: EncodedSlashBehavior;
  /** Block dot-segment traversal like '/../' and '/./' (default: true) */
  blockTraversal?: boolean;
  /** Enable LRU cache for match results (default: false) */
  enableCache?: boolean;
  /** Max entries for match LRU cache (default: 1024) */
  cacheSize?: number;
  /** Controls validation/execution guards for custom parameter regexes */
  regexSafety?: RegexSafetyOptions;
}

export interface RegexSafetyOptions {
  /** Throw vs warn when potentially unsafe regex가 감지될 때 */
  mode?: 'error' | 'warn';
  /** 허용할 최대 정규식 길이 (기본 256) */
  maxLength?: number;
  /** 중첩된 무한 반복(+, *) 패턴을 허용할지 여부 */
  forbidBacktrackingTokens?: boolean;
  /** 역참조(\1, \k<name>) 허용 여부 */
  forbidBackreferences?: boolean;
  /** 정규식 실행이 임계 시간을 초과하면 에러 처리 (ms) */
  maxExecutionMs?: number;
  /** 사용자 정의 검증 훅 */
  validator?: (pattern: string) => void;
}

export interface RouterSnapshotMetadata {
  readonly totalRoutes: number;
  readonly hasDynamicRoutes: boolean;
  readonly hasWildcardRoutes: boolean;
  readonly wildcardRouteCount: number;
  readonly methodsWithWildcard: readonly HttpMethod[];
  readonly builtAt: number;
}
