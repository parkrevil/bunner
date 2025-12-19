import { type Container } from '@bunner/core';

import type { RouteHandlerEntry } from './interfaces';
import type { RouteKey } from './types';

// Simple String Hash function (djb2)
function hash(str: string): number {
  let hash = 5381;
  let i = str.length;

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  return hash >>> 0;
}

export class RouteHandler {
  private container: Container;
  private metadataRegistry: Map<any, any>;
  private handlers: Map<RouteKey, RouteHandlerEntry> = new Map();

  constructor(container: Container, metadataRegistry: Map<any, any>) {
    this.container = container;
    this.metadataRegistry = metadataRegistry;
  }

  find(key: RouteKey): RouteHandlerEntry | undefined {
    return this.handlers.get(key);
  }

  register() {
    console.log('🔍 [RouteHandler] Registering routes from metadata...');
    for (const [targetClass, meta] of this.metadataRegistry.entries()) {
      // Check if it's a Controller
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

    Object.getPrototypeOf(instance);

    // Walk Methods
    (meta.methods || []).forEach((method: any) => {
      const routeDec = (method.decorators || []).find((d: any) =>
        ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head'].includes(d.name),
      );

      if (routeDec) {
        const httpMethodStr = this.mapDecoratorToMethod(routeDec.name); // E.g. "GET"
        const path = routeDec.arguments[0] || '';
        const fullPath = '/' + [prefix, path].filter(Boolean).join('/').replace(/\/+/g, '/');

        console.log(`🛣️  Route Registered: [${httpMethodStr}] ${fullPath} -> ${targetClass.name}.${method.name}`);

        const handler = instance[method.name].bind(instance);

        const paramTypes = (method.parameters || [])
          .sort((a: any, b: any) => a.index - b.index)
          .map((p: any) => {
            const d = (p.decorators || [])[0];
            if (!d) {
              return 'unknown';
            }
            return d.name.toLowerCase();
          });

        const entry: RouteHandlerEntry = {
          handler,
          paramType: paramTypes,
        };

        // Key: HASH("METHOD:PATH")
        const key = hash(`${httpMethodStr}:${fullPath}`.toUpperCase());
        this.handlers.set(key, entry);
        console.log(`   Key: ${key} (${httpMethodStr}:${fullPath})`);
      }
    });
  }

  private mapDecoratorToMethod(name: string): string {
    return name.toUpperCase();
  }
}
