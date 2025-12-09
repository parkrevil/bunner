import { Builder, type BuilderConfig, OptionalParamDefaults } from './builder';
import { Matcher } from './matcher';
import { Processor, type ProcessorConfig } from './processor';
import { HttpMethod } from './schema';
import type { RouteKey, RouteMatch, RouterOptions } from './types';

export class Router {
  private readonly options: RouterOptions;
  private readonly processor: Processor;
  private readonly builder: Builder;
  private matcher: Matcher | null = null;
  private cache: Map<string, RouteMatch | null> | undefined;
  private routeSeq: RouteKey = 1;

  constructor(options: RouterOptions = {}) {
    this.options = options;

    const procConfig: ProcessorConfig = {
      collapseSlashes: options.collapseSlashes ?? options.ignoreTrailingSlash ?? true,
      ignoreTrailingSlash: options.ignoreTrailingSlash ?? true,
      blockTraversal: options.blockTraversal ?? true,
      caseSensitive: options.caseSensitive ?? true,
      maxSegmentLength: options.maxSegmentLength ?? 256,
      failFastOnBadEncoding: options.failFastOnBadEncoding ?? false,
    };
    this.processor = new Processor(procConfig);

    if (options.enableCache) {
      this.cache = new Map();
    }
    const buildConfig: BuilderConfig = {
      regexSafety: {
        mode: options.regexSafety?.mode ?? 'error',
        maxLength: options.regexSafety?.maxLength ?? 256,
        forbidBacktrackingTokens: options.regexSafety?.forbidBacktrackingTokens ?? true,
        forbidBackreferences: options.regexSafety?.forbidBackreferences ?? true,
        maxExecutionMs: options.regexSafety?.maxExecutionMs,
        validator: options.regexSafety?.validator,
      },
      regexAnchorPolicy: options.regexAnchorPolicy,
      optionalParamDefaults: new OptionalParamDefaults(options.optionalParamBehavior),
      strictParamNames: options.strictParamNames,
    };
    this.builder = new Builder(buildConfig);
  }

  add(method: HttpMethod | HttpMethod[] | '*', path: string): RouteKey | RouteKey[] {
    if (this.matcher) {
      throw new Error('Router is sealed (compiled). Cannot add routes after matching.');
    }

    if (Array.isArray(method)) {
      return method.map(m => this.addOne(m, path));
    }
    if (method === '*') {
      const allMethods = [
        HttpMethod.Get,
        HttpMethod.Post,
        HttpMethod.Put,
        HttpMethod.Patch,
        HttpMethod.Delete,
        HttpMethod.Options,
        HttpMethod.Head,
      ];
      return allMethods.map(m => this.addOne(m, path));
    }
    return this.addOne(method, path);
  }

  addAll(entries: Array<[HttpMethod, string]>): RouteKey[] {
    return entries.map(([method, path]) => this.addOne(method, path));
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    // 1. Check Cache
    let cacheKey: string | undefined;
    if (this.options.enableCache) {
      cacheKey = `${method}:${path}`;
      const cached = this.cache?.get(cacheKey);
      if (cached !== undefined) {
        // LRU Promotion
        this.cache!.delete(cacheKey);
        this.cache!.set(cacheKey, cached);

        if (cached) {
          return {
            key: cached.key,
            params: { ...cached.params },
            meta: { source: 'cache' },
          };
        }
        return null;
      }
    }

    if (!this.matcher) {
      this.build();
    }
    const { segments, segmentDecodeHints, suffixPlan } = this.processor.normalize(path);
    // Trailing slash handled by processor (collapseSlashes checks ignoreTrailingSlash)

    const execResult = this.matcher!.exec(
      method,
      segments,
      segmentDecodeHints,
      this.options.decodeParams ?? true,
      false, // captureSnapshot
      () => suffixPlan,
    );

    if (execResult && this.builder.config.optionalParamDefaults) {
      this.builder.config.optionalParamDefaults.apply(execResult.key, execResult.params);
    }

    let result: RouteMatch | null = null;
    if (execResult) {
      result = {
        key: execResult.key,
        params: execResult.params,
      };
    }

    // 2. Set Cache
    if (this.options.enableCache && cacheKey && this.cache) {
      if (this.cache.size >= (this.options.cacheSize ?? 1000)) {
        // Simple LRU: Delete first item (insertion order)
        const first = this.cache.keys().next().value;
        if (first) {
          this.cache.delete(first);
        }
      }
      this.cache.set(cacheKey, result);
      // Return CLONE to user to protect cache
      if (result) {
        return {
          key: result.key,
          params: { ...result.params },
        };
      }
    }

    return result;
  }

  build(): void {
    if (this.matcher) {
      return;
    }
    const layout = this.builder.build();

    const testers = layout.patterns.map(p => {
      if (!p.source) {
        return undefined;
      }
      // Re-compile regex for runtime
      const regex = new RegExp(`^(?:${p.source})$`, p.flags);
      return buildPatternTester(p.source, regex, undefined);
    });

    this.matcher = new Matcher(layout, {
      patternTesters: testers,
      encodedSlashBehavior: this.options.encodedSlashBehavior ?? 'decode',
      failFastOnBadEncoding: this.options.failFastOnBadEncoding ?? false,
    });
  }

  private addOne(method: HttpMethod, path: string): RouteKey {
    const key = this.routeSeq++;
    // Pass stripQuery=false to preserve param modifiers like '?' in patterns
    const { segments } = this.processor.normalize(path, false);
    // Trailing slash handled by processor
    this.builder.add(method, segments, key);
    return key;
  }
}

export class RadixRouter extends Router {
  override build(): this {
    super.build();
    return this;
  }
}

export const RadixRouterBuilder = RadixRouter;

// --- Pattern Tester (Internal Helper) ---

const DIGIT_PATTERNS = new Set(['\\d+', '\\d{1,}', '[0-9]+', '[0-9]{1,}']);
const ALPHA_PATTERNS = new Set(['[a-zA-Z]+', '[A-Za-z]+']);
const ALPHANUM_PATTERNS = new Set(['[A-Za-z0-9_\\-]+', '[A-Za-z0-9_-]+', '\\w+', '\\w{1,}']);

export const ROUTE_REGEX_TIMEOUT = Symbol('bunner.route-regex-timeout');
type RouteRegexTimeoutError = Error & { [ROUTE_REGEX_TIMEOUT]?: true };

export interface PatternTesterOptions {
  maxExecutionMs?: number;
  onTimeout?: (pattern: string, durationMs: number) => boolean | void;
}

const now: () => number = (() => {
  if (typeof globalThis !== 'undefined' && globalThis.performance && typeof globalThis.performance.now === 'function') {
    return () => globalThis.performance.now();
  }
  return () => {
    const [sec, nano] = process.hrtime();
    return sec * 1000 + nano / 1e6;
  };
})();

function buildPatternTester(
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
