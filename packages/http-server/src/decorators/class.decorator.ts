import type { ControllerDecoratorOptions, ControllerMetadata } from './interfaces';
import { metadataRegistry } from '@bunner/core';

/**
 * Controller Decorators
 * @param options 
 * @returns 
 */
export function Controller(path?: string, options?: ControllerDecoratorOptions): ClassDecorator {
  return function (target: any) {
    const routes = target.__routes ?? [];
    const metadata: ControllerMetadata = {
      target,
      path: path ?? '',
      routes,
    };

    metadataRegistry.controllers.push(metadata);
  };
}
