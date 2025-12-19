import { type Container } from '@bunner/core';

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
  private routes: InternalRoute[] = [];

  constructor(container: Container, metadataRegistry: Map<any, any>) {
    this.container = container;
    this.metadataRegistry = metadataRegistry;
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
          params[name] = match[index + 1];
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
    console.log('🔍 [RouteHandler] Registering routes from metadata...');
    for (const [targetClass, meta] of this.metadataRegistry.entries()) {
      const controllerDec = (meta.decorators || []).find((d: any) => d.name === 'Controller' || d.name === 'RestController');

      if (controllerDec) {
        console.log(`FOUND Controller: ${meta.className}`);
        this.registerController(targetClass, meta, controllerDec);
      }
    }
  }

  private registerController(targetClass: any, meta: any, controllerDec: any) {
    const prefix = controllerDec.arguments[0] || '';
    const instance = this.container.get(targetClass);

    if (!instance) {
      console.warn(`⚠️  Cannot resolve controller instance: ${meta.className}`);
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

        console.log(`🛣️  Route Registered: [${httpMethod}] ${fullPath} -> ${targetClass.name}.${method.name}`);

        const { regex, paramNames } = this.pathToRegex(fullPath);

        const paramTypes = (method.parameters || [])
          .sort((a: any, b: any) => a.index - b.index)
          .map((p: any) => {
            const d = (p.decorators || [])[0];
            return d ? d.name.toLowerCase() : 'unknown';
          });

        const entry: RouteHandlerEntry = {
          handler: instance[method.name].bind(instance),
          paramType: paramTypes,
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
