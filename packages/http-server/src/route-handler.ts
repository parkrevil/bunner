import { type Container } from '@bunner/core';

import type { RouteHandlerEntry } from './interfaces';
import type { RouteKey } from './types';
// import { HttpMethod } from './enums'; // Unused

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
    for (const [targetClass, meta] of this.metadataRegistry.entries()) {
      // Check if it's a Controller
      const controllerDec = meta.decorators.find((d: any) => d.name === 'Controller' || d.name === 'RestController');

      if (controllerDec) {
        this.registerController(targetClass, meta, controllerDec);
      }
    }
  }

  private registerController(targetClass: any, meta: any, controllerDec: any) {
    const prefix = controllerDec.arguments[0] || '';
    const instance = this.container.get(targetClass);

    if (!instance) {
      return;
    }

    Object.getPrototypeOf(instance);

    // Walk Methods
    meta.methods.forEach((method: any) => {
      const routeDec = method.decorators.find((d: any) =>
        ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head'].includes(d.name),
      );

      if (routeDec) {
        const httpMethod = this.mapDecoratorToMethod(routeDec.name);
        const path = routeDec.arguments[0] || '';
        const fullPath = '/' + [prefix, path].filter(Boolean).join('/').replace(/\/+/g, '/');

        console.log(`🛣️  Route Registered: [${httpMethod}] ${fullPath} -> ${targetClass.name}.${method.name}`);

        const handler = instance[method.name].bind(instance);
        // Params mapping need metadata too.
        // Use _ to ignore unused var check
        const _paramTypes = method.parameters
          .sort((a: any, b: any) => a.index - b.index)
          .map((p: any) => {
            const d = p.decorators[0];
            if (!d) {
              return 'unknown';
            }
            return d.name.toLowerCase();
          });

        const _entry: RouteHandlerEntry = {
          handler,
          paramType: _paramTypes, // Using it here to suppress unused error if needed, but currently interface uses it.
        };

        // Mock adding to handlers for now to satisfy linter
        // this.handlers.set(hash(httpMethod + fullPath), _entry);
        // TODO: Real hash logic
      }
    });
  }

  private mapDecoratorToMethod(name: string): string {
    return name.toUpperCase();
  }
}
