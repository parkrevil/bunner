import { type Container } from '@bunner/core';
import { Logger } from '@bunner/logger';

import type { RouteHandlerEntry } from './interfaces';

export interface MatchResult {
  entry: RouteHandlerEntry;
  params: Record<string, string>;
}

interface InternalRoute {
  method: string;
  path: string;
  regex: RegExp;
  paramNames: string[];
  entry: RouteHandlerEntry;
}

export class RouteHandler {
  private container: Container;
  private metadataRegistry: Map<any, any>;
  private scopedKeys: Map<any, string>;
  private routes: InternalRoute[] = [];
  private readonly logger = new Logger(RouteHandler.name);

  constructor(container: Container, metadataRegistry: Map<any, any>, scopedKeys: Map<any, string> = new Map()) {
    this.container = container;
    this.metadataRegistry = metadataRegistry;
    this.scopedKeys = scopedKeys;
  }

  match(method: string, path: string): MatchResult | undefined {
    const methodUpper = method.toUpperCase();

    for (const route of this.routes) {
      if (route.method !== methodUpper) {
        continue;
      }

      const match = route.regex.exec(path);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1] || '';
        });
        return {
          entry: route.entry,
          params,
        };
      }
    }
    return undefined;
  }

  register() {
    this.logger.debug('🔍 Registering routes from metadata...');
    for (const [targetClass, meta] of this.metadataRegistry.entries()) {
      const controllerDec = (meta.decorators || []).find((d: any) => d.name === 'Controller' || d.name === 'RestController');

      if (controllerDec) {
        this.logger.debug(`FOUND Controller: ${meta.className}`);
        this.registerController(targetClass, meta, controllerDec);
      }
    }
  }

  private registerController(targetClass: any, meta: any, controllerDec: any) {
    const prefix = controllerDec.arguments[0] || '';

    // Resolve Instance using Scoped Key if available
    const scopedKey = this.scopedKeys.get(targetClass);
    let instance;

    if (scopedKey) {
      instance = this.container.get(scopedKey);
    } else {
      // Fallback for legacy or unscoped
      instance = this.container.get(targetClass);
    }

    if (!instance) {
      this.logger.warn(`⚠️  Cannot resolve controller instance: ${meta.className} (Key: ${scopedKey || targetClass.name})`);
      return;
    }

    (meta.methods || []).forEach((method: any) => {
      const routeDec = (method.decorators || []).find((d: any) =>
        ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head'].includes(d.name),
      );

      if (routeDec) {
        const httpMethod = routeDec.name.toUpperCase();
        const subPath = routeDec.arguments[0] || '';
        const fullPath = '/' + [prefix, subPath].filter(Boolean).join('/').replace(/\/+/g, '/');

        this.logger.info(`🛣️  Route Registered: [${httpMethod}] ${fullPath} -> ${targetClass.name}.${method.name}`);

        const { regex, paramNames } = this.pathToRegex(fullPath);

        const paramTypes = (method.parameters || [])
          .sort((a: any, b: any) => a.index - b.index)
          .map((p: any) => {
            const d = (p.decorators || [])[0];
            return d ? d.name.toLowerCase() : 'unknown';
          });

        const paramRefs = (method.parameters || []).sort((a: any, b: any) => a.index - b.index).map((p: any) => p.type); // type is now Ref or String from MetadataRegistry

        const entry: RouteHandlerEntry = {
          handler: instance[method.name].bind(instance),
          paramType: paramTypes,
          paramRefs,
        };

        this.routes.push({
          method: httpMethod,
          path: fullPath,
          regex,
          paramNames,
          entry,
        });
      }
    });
  }

  private pathToRegex(path: string) {
    const paramNames: string[] = [];
    const pattern = path
      .replace(/[\\$.+*?^|[\](){}]/g, '\\$&') // Escape characters
      .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });

    return {
      regex: new RegExp(`^${pattern}$`),
      paramNames,
    };
  }
}
