import picomatch from 'picomatch';
import type { GlobalMiddlewareOptions, GlobalMiddlewareRegistry, Middleware, MiddlewareContext, MiddlewarePhase, RouteMiddlewareOptions, RouteMiddlewareRegistry } from './interfaces';
import type { MiddlewareGroup, PhaseMiddlewareMap } from './types';

export class MiddlewareValidationError extends Error { }

/**
 * Manages registration and execution of global and route-level middlewares.
 */
export class MiddlewareProvider {
  private readonly global: GlobalMiddlewareRegistry;
  private readonly route: RouteMiddlewareRegistry;
  private readonly phaseMap: WeakMap<Function, PhaseMiddlewareMap> = new WeakMap();

  constructor() {
    this.global = {
      onRequest: [],
      beforeHandler: [],
      afterHandler: [],
      afterResponse: [],
    };

    this.route = {
      beforeHandler: [] as Array<{ pattern: string; middleware: MiddlewareGroup }>,
      afterHandler: [] as Array<{ pattern: string; middleware: MiddlewareGroup }>,
    };
  }

  /**
   * Check if a value is a BunnerResponse by duck-typing (has toResponse function).
   */
  private isBunnerResponse(value: any): boolean {
    return !!value && typeof (value as any).toResponse === 'function';
  }

  /**
   * Register global middlewares for each lifecycle phase.
   */
  addGlobalMiddlewares(options: GlobalMiddlewareOptions) {
    options.onRequest && this.global.onRequest.push(
      ...this.normalize(options.onRequest)
    );
    options.beforeHandler && this.global.beforeHandler.push(
      ...this.normalize(options.beforeHandler)
    );
    options.afterHandler && this.global.afterHandler.push(
      ...this.normalize(options.afterHandler)
    );
    options.afterResponse && this.global.afterResponse.push(
      ...this.normalize(options.afterResponse)
    );
  }

  /**
   * Precompute matched route middlewares for a concrete method+path.
   */
  precomputeForRoute(path: string) {
    return {
      beforeHandler: this.matchRoutePatterns(path, 'beforeHandler'),
      afterHandler: this.matchRoutePatterns(path, 'afterHandler'),
    };
  }

  setPhaseMap(handler: Function, map: PhaseMiddlewareMap) {
    this.phaseMap.set(handler, map);
  }

  getPhaseMap(handler: Function): PhaseMiddlewareMap | undefined {
    return this.phaseMap.get(handler);
  }

  // No httpMethod-based keys; matching is path-only per requirements

  /**
   * Register route-matching middlewares for before/after handler phases.
   * Pattern supports OR between glob and regex-like (re:/.../ or /.../).
   */
  addRouteMiddlewares(options: RouteMiddlewareOptions) {
    if (options.beforeHandler) {
      for (const [pattern, group] of Object.entries(options.beforeHandler)) {
        const validated = this.assertAndReturn(group);
        this.route.beforeHandler.push({ pattern, middleware: validated });
      }
    }

    if (options.afterHandler) {
      for (const [pattern, group] of Object.entries(options.afterHandler)) {
        const validated = this.assertAndReturn(group);
        this.route.afterHandler.push({ pattern, middleware: validated });
      }
    }
  }

  private normalize(groups: MiddlewareGroup[]): MiddlewareGroup[] {
    groups.forEach((middlewareGroup) => this.assertAndReturn(middlewareGroup));

    return groups;
  }

  private assertAndReturn(middleware: MiddlewareGroup): MiddlewareGroup {
    const validate = (item: Middleware) => this.validateMiddleware(item);

    if (Array.isArray(middleware)) {
      middleware.forEach(validate);
    } else {
      validate(middleware);
    }

    return middleware;
  }

  private validateMiddleware(middleware: Middleware) {
    if (!middleware || typeof middleware !== 'object') {
      throw new MiddlewareValidationError('Invalid middleware: expected object');
    }

    if (typeof middleware.run !== 'function') {
      throw new MiddlewareValidationError('Invalid middleware: missing run() function');
    }
  }

  private matchRoutePatterns(path: string, phase: 'beforeHandler' | 'afterHandler') {
    const source = this.route[phase];
    const matched: MiddlewareGroup[] = [];
    for (const entry of source) {
      if (this.testPattern(path, entry.pattern)) {
        matched.push(entry.middleware);
      }
    }
    return matched;
  }

  private testPattern(path: string, pattern: string): boolean {
    const regexLike = /^\s*(?:re:|\/)(.*?)(?:\/)\s*$/i;
    const matched = pattern.match(regexLike);
    if (matched && typeof matched[1] === 'string') {
      try {
        return new RegExp(matched[1] as string).test(path);
      } catch {
        return false;
      }
    }

    const isMatch = picomatch(pattern, { dot: true, nocase: false });
    return isMatch(path);
  }

  private async runGroup(context: MiddlewareContext, _phase: MiddlewarePhase, group: MiddlewareGroup) {
    const callHook = async (middleware: Middleware) => {
      const hookResult = await middleware.run(context.req, context.res);

      if (this.isBunnerResponse(hookResult)) {
        return { response: hookResult };
      }

      return {};
    };

    if (Array.isArray(group)) {
      const parallelResults = await Promise.all(group.map(async (middleware) => {
        try {
          return await callHook(middleware);
        } catch (error) {
          return { error };
        }
      }));

      const firstError = parallelResults.find((item) => 'error' in item) as any;
      if (firstError) {
        return { error: firstError.error };
      }

      const firstResponse = parallelResults.find((item) => this.isBunnerResponse((item as any).response)) as any;
      if (firstResponse) {
        return { response: firstResponse.response };
      }

      return {};
    }

    try {
      return await callHook(group);
    } catch (error) {
      return { error };
    }
  }

  async executePhase(context: MiddlewareContext, phase: 'onRequest' | 'beforeHandler', path: string): Promise<any | void>;
  async executePhase(context: MiddlewareContext, phase: 'afterHandler' | 'afterResponse', path: string): Promise<void>;
  async executePhase(context: MiddlewareContext, phase: MiddlewarePhase, path: string): Promise<any | void> {
    const globalGroups = this.global[phase as keyof GlobalMiddlewareRegistry] as MiddlewareGroup[] | undefined;
    const routeGroups = (phase === 'beforeHandler' || phase === 'afterHandler') ? this.matchRoutePatterns(path, phase) : [];
    const queues = this.buildExecutionQueues(phase, globalGroups, routeGroups);

    for (const queue of queues) {
      for (const group of queue) {
        const result = await this.runGroup(context, phase, group);
        if ((result as any).error) {
          throw (result as any).error;
        }
        if ((result as any).response && (phase === 'onRequest' || phase === 'beforeHandler')) {
          return (result as any).response;
        }
      }
    }

    return;
  }

  async executeGroups(context: MiddlewareContext, phase: MiddlewarePhase, groups: Array<MiddlewareGroup | undefined>) {
    for (const group of groups) {
      if (!group) continue;

      const result = await this.runGroup(context, phase, group);

      if ((result as any).error) throw (result as any).error;

      if ((result as any).response && (phase === 'onRequest' || phase === 'beforeHandler')) {
        return (result as any).response;
      }
    }
  }

  /**
   * Build execution queues for the given phase.
   */
  private buildExecutionQueues(phase: MiddlewarePhase, globalGroups?: MiddlewareGroup[], routeGroups: MiddlewareGroup[] = []): MiddlewareGroup[][] {
    const queues: MiddlewareGroup[][] = [];

    switch (phase) {
      case 'onRequest':
      case 'beforeHandler':
        if (globalGroups?.length) queues.push(globalGroups);
        if (routeGroups.length) queues.push(routeGroups);
        break;
      case 'afterHandler':
        if (routeGroups.length) queues.push([...routeGroups].reverse());
        if (globalGroups?.length) queues.push([...(globalGroups)].reverse());
        break;
      case 'afterResponse':
        if (globalGroups?.length) queues.push(globalGroups);
        break;
    }

    return queues;
  }
}


