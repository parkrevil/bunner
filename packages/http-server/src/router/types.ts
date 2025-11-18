import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import type { ImmutableRouterLayout } from './immutable-layout';

export type PatternTesterFn = (value: string) => boolean;

export type EncodedSlashBehavior = 'decode' | 'preserve' | 'reject';

export type OptionalParamBehavior = 'omit' | 'setUndefined' | 'setEmptyString';

export interface NormalizedPathSegments {
  normalized: string;
  segments: string[];
}

export type RouteParams = Record<string, string | undefined>;

export interface RouteMatch {
  key: RouteKey;
  params: RouteParams;
  meta?: RouteMatchMeta;
}

export interface RouteMatchMeta {
  readonly source?: 'static-fast' | 'cache' | 'dynamic' | 'auto-options';
  readonly allow?: readonly HttpMethod[];
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
  suffixPlan?: SuffixPlan;
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
  params: RouteParams;
  snapshot?: Array<[string, string | undefined]>;
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
  /** Automatically fall back to GET routes when HEAD is requested (default: true) */
  headFallbackToGet?: boolean;
  /** Synthesize OPTIONS responses based on registered methods (default: true) */
  autoOptions?: boolean;
  /** Enforce globally unique parameter names when true */
  strictParamNames?: boolean;
  /** Control how optional parameters behave when missing */
  optionalParamBehavior?: OptionalParamBehavior;
  /** Controls validation/execution guards for custom parameter regexes */
  regexSafety?: RegexSafetyOptions;
  /** Policy for handling user-supplied ^/$ anchors inside parameter regexes */
  regexAnchorPolicy?: 'warn' | 'error' | 'silent';
  /** Advanced tuning for parameter branch reordering */
  paramOrderTuning?: ParamOrderingOptions;
  /** Hook bundle for router observability */
  observers?: RouterObserverHooks;
  /** Stage toggles for build/match pipelines */
  pipelineStages?: Partial<PipelineStageConfig>;
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

export interface ParamOrderingOptions {
  baseThreshold?: number;
  reseedProbability?: number;
  snapshot?: ParamOrderSnapshot;
}

export interface ParamOrderSnapshot {
  edgeHits: number[];
}

export interface SuffixPlan {
  source: string;
  offsets: Uint32Array;
}

export interface RouterObserverHooks {
  onRouteMatch?: (event: RouteMatchEvent) => void;
  onCacheHit?: (event: CacheEvent) => void;
  onCacheMiss?: (event: CacheEvent) => void;
  onStaticFastHit?: (event: StaticFastEvent) => void;
  onParamBranchTaken?: (event: ParamBranchEvent) => void;
  onStageStart?: (event: StageEvent) => void;
  onStageEnd?: (event: StageEvent & { durationMs: number }) => void;
}

export interface RouteMatchEvent {
  method: HttpMethod;
  path: string;
  match: RouteMatch;
  fromCache: boolean;
}

export interface CacheEvent {
  key: string;
  method: HttpMethod;
  path: string;
}

export interface StaticFastEvent {
  method: HttpMethod;
  path: string;
  key: RouteKey;
}

export interface ParamBranchEvent {
  nodeIndex: number;
  localOffset: number;
}

export type BuildStageName = 'compress-static' | 'param-priority' | 'wildcard-suffix' | 'regex-safety' | 'route-flags' | 'snapshot-metadata';
export type MatchStageName = 'static-fast' | 'cache' | 'dynamic';

export interface StageEvent {
  stage: `build:${BuildStageName}` | `match:${MatchStageName}`;
  context: Record<string, unknown>;
}

export interface PipelineStageConfig {
  build: Record<BuildStageName, boolean>;
  match: Record<MatchStageName, boolean>;
}
