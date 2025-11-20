import type {
  EncodedSlashBehavior,
  ParamOrderSnapshot,
  ParamOrderingOptions,
  PipelineStageConfig,
  RegexSafetyOptions,
  RouterOptions,
} from '../types';

export type NormalizedRegexSafetyOptions = {
  mode: 'error' | 'warn';
  maxLength: number;
  forbidBacktrackingTokens: boolean;
  forbidBackreferences: boolean;
  maxExecutionMs?: number;
  validator?: (pattern: string) => void;
};

export type NormalizedParamOrderingOptions = {
  snapshot?: ParamOrderSnapshot;
};

export type NormalizedRouterOptions = Omit<
  Required<RouterOptions>,
  'regexSafety' | 'encodedSlashBehavior' | 'paramOrderTuning' | 'pipelineStages'
> & {
  regexSafety: NormalizedRegexSafetyOptions;
  encodedSlashBehavior: EncodedSlashBehavior;
  paramOrderTuning: NormalizedParamOrderingOptions;
  pipelineStages?: Partial<PipelineStageConfig>;
};

export const DEFAULT_REGEX_SAFETY: NormalizedRegexSafetyOptions = {
  mode: 'error',
  maxLength: 256,
  forbidBacktrackingTokens: true,
  forbidBackreferences: true,
  maxExecutionMs: undefined,
};

export const STATIC_NORMALIZATION_CACHE_LIMIT = 128;

export const DEFAULT_PIPELINE_STAGE_CONFIG: PipelineStageConfig = {
  build: {
    'compress-static': true,
    'param-priority': true,
    'wildcard-suffix': true,
    'regex-safety': true,
    'route-flags': true,
    'snapshot-metadata': true,
  },
  match: {
    'static-fast': true,
    cache: true,
    dynamic: true,
  },
};

export function normalizeRegexSafety(input?: RegexSafetyOptions): NormalizedRegexSafetyOptions {
  return {
    mode: input?.mode ?? DEFAULT_REGEX_SAFETY.mode,
    maxLength: input?.maxLength ?? DEFAULT_REGEX_SAFETY.maxLength,
    forbidBacktrackingTokens: input?.forbidBacktrackingTokens ?? DEFAULT_REGEX_SAFETY.forbidBacktrackingTokens,
    forbidBackreferences: input?.forbidBackreferences ?? DEFAULT_REGEX_SAFETY.forbidBackreferences,
    maxExecutionMs: input?.maxExecutionMs ?? DEFAULT_REGEX_SAFETY.maxExecutionMs,
    validator: input?.validator,
  };
}

export function normalizeParamOrderOptions(input?: ParamOrderingOptions): NormalizedParamOrderingOptions {
  return {
    snapshot: input?.snapshot,
  };
}

export function normalizePipelineStages(input?: Partial<PipelineStageConfig>): PipelineStageConfig {
  const build: PipelineStageConfig['build'] = { ...DEFAULT_PIPELINE_STAGE_CONFIG.build };
  const match: PipelineStageConfig['match'] = { ...DEFAULT_PIPELINE_STAGE_CONFIG.match };
  if (input?.build) {
    for (const name of Object.keys(build) as (keyof PipelineStageConfig['build'])[]) {
      if (typeof input.build[name] === 'boolean') {
        build[name] = Boolean(input.build[name]);
      }
    }
  }
  if (input?.match) {
    for (const name of Object.keys(match) as (keyof PipelineStageConfig['match'])[]) {
      if (typeof input.match[name] === 'boolean') {
        match[name] = Boolean(input.match[name]);
      }
    }
  }
  return { build, match };
}
