import { ModuleDecorator } from './constants';
import type { DynamicModule, ModuleMetadata } from './interfaces';

/**
 * Module Decorator
 * Marks a class as a module and defines its metadata
 */
export function Module(metadata: ModuleMetadata) {
  return function (target: any) {
    Reflect.defineMetadata(ModuleDecorator, metadata, target);
    // Also attach a static forRoot/forFeature helper factory on the class for convenience
    (target as any).forRoot = (config?: any): DynamicModule => ({ module: target, ...(config || {}) });
    (target as any).forRootAsync = (factory: () => Promise<any>): Promise<DynamicModule> => factory().then(cfg => ({ module: target, ...(cfg || {}) }));
    (target as any).forFeature = (config?: any): DynamicModule => ({ module: target, ...(config || {}) });
    (target as any).forFeatureAsync = (factory: () => Promise<any>): Promise<DynamicModule> => factory().then(cfg => ({ module: target, ...(cfg || {}) }));
  };
}
