export interface RegexAssessment {
  safe: boolean;
  reason?: string;
}

export interface RegexSafetyStaticConfig {
  maxLength: number;
  forbidBacktrackingTokens: boolean;
  forbidBackreferences: boolean;
}

const BACKREFERENCE_PATTERN = /\\(?:\d+|k<[^>]+>)/;
const REPEATED_GROUP_PATTERN = /(\((?:[^()]|\\\(|\\\))*?[+*](?:[^()]|\\\(|\\\))*?\))(?:\{|\*|\+)/;

export function assessRegexSafety(pattern: string, options: RegexSafetyStaticConfig): RegexAssessment {
  if (pattern.length > options.maxLength) {
    return { safe: false, reason: `Regex length ${pattern.length} exceeds limit ${options.maxLength}` };
  }
  if (options.forbidBackreferences && BACKREFERENCE_PATTERN.test(pattern)) {
    return { safe: false, reason: 'Backreferences are not allowed in route params' };
  }
  if (options.forbidBacktrackingTokens && REPEATED_GROUP_PATTERN.test(pattern)) {
    return { safe: false, reason: 'Nested unlimited quantifiers detected' };
  }
  return { safe: true };
}
