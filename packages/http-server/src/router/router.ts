import type { HttpMethod } from '../types';

import { Builder, OptionalParamDefaults } from './builder';
import { RouterCache } from './cache';
import { Matcher } from './matcher';
import { buildPatternTester } from './matcher/pattern-tester';
import { Processor, type ProcessorConfig } from './processor';
import type { DynamicMatchResult, Handler, MatchResultMeta, RouterOptions } from './types';

/**
 * High-performance generic router.
 */
export class Router<R = any> {
  private readonly options: RouterOptions;
  private readonly processor: Processor;
  private readonly builder: Builder<Handler<R>>;
  private matcher: Matcher | null = null;
  private cache: RouterCache<DynamicMatchResult> | undefined;

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
      this.cache = new RouterCache(options.cacheSize);
    }
    const buildConfig = {
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
    this.builder = new Builder<Handler<R>>(buildConfig);
  }

  /**
   * Registers a route.
   */
  add(method: HttpMethod | HttpMethod[] | '*', path: string, handler: Handler<R>): void {
    // If the router is already built, we cannot add more routes safely without rebuilding
    // or invalidating internal structures. For now, assume mutable phase only before build()
    // or allow add() but warn/reset matcher.
    if (this.matcher) {
      // For this implementation, we simply allow adding.
      // Real-world would likely throw or rebuild.
      this.matcher = null; // Invalidate
    }

    if (Array.isArray(method)) {
      method.forEach(m => this.addOne(m, path, handler));
      return;
    }

    if (method === '*') {
      const allMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
      allMethods.forEach(m => this.addOne(m, path, handler));
      return;
    }

    this.addOne(method, path, handler);
  }

  /**
   * Batch registration.
   */
  addAll(entries: Array<[HttpMethod, string, Handler<R>]>): void {
    for (const [method, path, handler] of entries) {
      this.add(method, path, handler);
    }
  }

  /**
   * Finalizes the router and prepares for matching.
   */
  build(): Router<R> {
    if (this.matcher) {
      return this;
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
    return this;
  }

  /**
   * Resolve a request. Executes the matched handler.
   */
  match(method: HttpMethod, path: string): R | null {
    // 1. Pre-process
    // We don't have full path normalization here yet (handled by builder for registration).
    // But for matching, we need to pass the raw path to matcher?
    // Matcher expects decoded logic or raw string? Matcher.walk takes (decodeParams).
    // We need to handle `ignoreTrailingSlash` etc. which are partially handled by structure but also inputs.

    // Simplification: Processor should arguably run on input path too?
    // If we have `Processor.process(path) -> segments[]`, we could use that.
    // usage: `matcher.match(segments)`?
    // Current `matcher.match` takes `path: string` (and internally slices it?).
    // No, `matcher.exec(method, segments)`.
    // Wait, Router implementation of `match` previously called `matcher.exec`.

    // See lines 122+ of original `Router`.
    // It normalized path manually?
    // "path" argument is assumed to be the URL pathname.

    let searchPath = path;

    // Fast-path: Trailing slash
    if (this.options.ignoreTrailingSlash && searchPath.length > 1 && searchPath.endsWith('/')) {
      searchPath = searchPath.slice(0, -1);
    }

    // Case sensitivity
    // Handled by builder structure (normalized to lower case if insensitive).
    // But input path matching relies on `Matcher` walking. `Matcher` compares segments.
    // If insensitive, `Matcher` logic should have handled it?
    // Actually `Matcher` compares strictly against node segments.
    // If insensitive, builder lowercased keys.
    // Input must be lowercased if insensitive?
    // `this.options.caseSensitive` defaults true.
    if (this.options.caseSensitive === false) {
      searchPath = searchPath.toLowerCase();
    }

    // Cache Lookup
    if (this.cache) {
      const cacheKey = `${method}:${searchPath}`;
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) {
        if (cached === null) {
          return null;
        }
        // Execute Handler
        const handler = this.builder.handlers[cached.handlerIndex];
        if (!handler) {
          return null;
        }
        return handler({ ...cached.params }, { source: 'cache' });
      }
    }

    if (!this.matcher) {
      this.build();
    }

    // Process Segments
    // "segments" are needed for Matcher.
    // `processor.process(searchPath)` returns string[].
    const { segments, segmentDecodeHints, suffixPlan } = this.processor.normalize(searchPath);

    // Dynamic Match
    const execResult = this.matcher!.exec(
      method,
      segments,
      segmentDecodeHints,
      this.options.decodeParams ?? true,
      false, // captureSnapshot
      () => suffixPlan,
    );

    const defaults = this.builder.config.optionalParamDefaults;
    if (execResult && defaults) {
      defaults.apply(execResult.handlerIndex, execResult.params);
    }

    if (execResult) {
      // Execute Handler
      const handler = this.builder.handlers[execResult.handlerIndex];
      // Handlers are guaranteed by build process but array access returns potential undefined
      if (!handler) {
        return null;
      }
      const meta: MatchResultMeta = { source: 'dynamic' };

      // Update Cache
      if (this.cache) {
        const cacheKey = `${method}:${searchPath}`;
        this.cache.set(cacheKey, {
          handlerIndex: execResult.handlerIndex,
          params: execResult.params,
        });
      }

      return handler({ ...execResult.params }, meta);
    }

    // Cache Miss
    if (this.cache) {
      const cacheKey = `${method}:${searchPath}`;
      this.cache.set(cacheKey, null);
    }

    return null;
  }

  private addOne(method: HttpMethod, path: string, handler: Handler<R>): void {
    const { segments } = this.processor.normalize(path, false);
    // Trailing slash handled by processor
    this.builder.add(method, segments, handler);
  }
}
