import type { HttpMethod } from './schema';

export type RouteKey = number;

export interface RouterOptions {
  ignoreTrailingSlash?: boolean;
  collapseSlashes?: boolean;
  caseSensitive?: boolean;
  decodeParams?: boolean;
  preserveEncodedSlashes?: boolean;
  encodedSlashBehavior?: EncodedSlashBehavior;
  blockTraversal?: boolean;
  enableCache?: boolean;
  cacheSize?: number;
  maxSegmentLength?: number;
  strictParamNames?: boolean;
  optionalParamBehavior?: OptionalParamBehavior;
  regexSafety?: RegexSafetyOptions;
  regexAnchorPolicy?: 'warn' | 'error' | 'silent';
  paramOrderTuning?: ParamOrderingOptions;
  pipelineStages?: Partial<PipelineStageConfig>;
  failFastOnBadEncoding?: boolean;
}

export type EncodedSlashBehavior = 'decode' | 'preserve' | 'reject';
export type OptionalParamBehavior = 'omit' | 'setUndefined' | 'setEmptyString';

export interface RegexSafetyOptions {
  mode?: 'error' | 'warn';
  maxLength?: number;
  forbidBacktrackingTokens?: boolean;
  forbidBackreferences?: boolean;
  maxExecutionMs?: number;
  validator?: (pattern: string) => void;
}

export interface ParamOrderingOptions {
  baseThreshold?: number;
  reseedProbability?: number;
  snapshot?: ParamOrderSnapshot;
  sampleRate?: number;
}

export interface ParamOrderSnapshot {
  edgeHits: number[];
  nodeOrders?: ParamNodeOrderSnapshot[];
}

export interface ParamNodeOrderSnapshot {
  nodeIndex: number;
  order: number[];
}

export interface PipelineStageConfig {
  build: Record<BuildStageName, boolean>;
  match: Record<MatchStageName, boolean>;
}

export type BuildStageName =
  | 'compress-static'
  | 'param-priority'
  | 'wildcard-suffix'
  | 'regex-safety'
  | 'route-flags'
  | 'snapshot-metadata';
export type MatchStageName = 'static-fast' | 'cache' | 'dynamic';

export type PatternTesterFn = (value: string) => boolean;

export interface NormalizedPathSegments {
  normalized: string;
  segments: string[];
  segmentOffsets?: Uint32Array;
  segmentDecodeHints?: Uint8Array;
  suffixSource?: string;
  suffixSlices?: string[];
  suffixPlan?: SuffixPlan;
  hadTrailingSlash?: boolean;
}

export interface SuffixPlan {
  source: string;
  offsets: Uint32Array;
  slices?: string[];
}

export type RouteParams = Record<string, string | undefined>;

export interface RouteMatch {
  key: RouteKey;
  params: RouteParams;
  meta?: RouteMatchMeta;
}

export interface RouteMatchMeta {
  readonly source?: 'static-fast' | 'cache' | 'dynamic';
}

export interface DynamicMatchResult {
  key: RouteKey;
  params: RouteParams;
  snapshot?: Array<[string, string | undefined]>;
}

// Router Interfaces
export interface RouterInstance {
  match(method: HttpMethod, path: string): RouteMatch | null;
}

export interface RouterBuilder {
  add(method: HttpMethod | HttpMethod[] | '*', path: string): RouteKey | RouteKey[];
  addAll(entries: Array<[HttpMethod, string]>): RouteKey[];
  build(): RouterInstance;
}
