export const ROUTE_REGEX_TIMEOUT = Symbol('bunner.route-regex-timeout');
export type RouteRegexTimeoutError = Error & { [ROUTE_REGEX_TIMEOUT]?: true };

export interface PatternTesterOptions {
  maxExecutionMs?: number;
  onTimeout?: (pattern: string, durationMs: number) => boolean | void;
}

const DIGIT_PATTERNS = new Set(['\\d+', '\\d{1,}', '[0-9]+', '[0-9]{1,}']);
const ALPHA_PATTERNS = new Set(['[a-zA-Z]+', '[A-Za-z]+']);
const ALPHANUM_PATTERNS = new Set(['[A-Za-z0-9_\\-]+', '[A-Za-z0-9_-]+', '\\w+', '\\w{1,}']);

const now: () => number = (() => {
  if (typeof globalThis !== 'undefined' && globalThis.performance && typeof globalThis.performance.now === 'function') {
    return () => globalThis.performance.now();
  }
  return () => {
    const [sec, nano] = process.hrtime();
    return sec * 1000 + nano / 1e6;
  };
})();

export function buildPatternTester(
  source: string | undefined,
  compiled: RegExp,
  options?: PatternTesterOptions,
): (value: string) => boolean {
  const raw = source ?? '<anonymous>';
  const wrap = (tester: (value: string) => boolean): ((value: string) => boolean) => {
    if (!options?.maxExecutionMs || options.maxExecutionMs <= 0) {
      return tester;
    }
    const limit = options.maxExecutionMs;
    return value => {
      const start = now();
      const result = tester(value);
      const duration = now() - start;
      if (duration > limit) {
        const shouldThrow = options.onTimeout?.(raw, duration);
        if (shouldThrow === false) {
          return false;
        }
        const timeoutError: RouteRegexTimeoutError = new Error(
          `Route parameter regex '${raw}' exceeded ${limit} ms(took ${duration.toFixed(3)}ms)`,
        );
        timeoutError[ROUTE_REGEX_TIMEOUT] = true;
        throw timeoutError;
      }
      return result;
    };
  };

  if (!source) {
    return wrap(value => compiled.test(value));
  }
  if (DIGIT_PATTERNS.has(source)) {
    return isAllDigits;
  }
  if (ALPHA_PATTERNS.has(source)) {
    return isAlpha;
  }
  if (ALPHANUM_PATTERNS.has(source)) {
    return isAlphaNumericDash;
  }
  if (source === '[^/]+') {
    return value => value.length > 0 && value.indexOf('/') === -1;
  }
  return wrap(value => compiled.test(value));
}

function isAllDigits(value: string): boolean {
  if (!value.length) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) {
      return false;
    }
  }
  return true;
}

function isAlpha(value: string): boolean {
  if (!value.length) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    if (!upper && !lower) {
      return false;
    }
  }
  return true;
}

function isAlphaNumericDash(value: string): boolean {
  if (!value.length) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    const digit = code >= 48 && code <= 57;
    if (!upper && !lower && !digit && code !== 45 && code !== 95) {
      return false;
    }
  }
  return true;
}