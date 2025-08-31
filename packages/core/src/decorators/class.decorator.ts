import { INJECT_DEPS_KEY, metadataRegistry } from './constants';
import type { InjectableDecoratorOptions, InjectableMetadata, ModuleDecoratorOptions } from './interfaces';

/**
 * Module Decorator
 * Marks a class as a module and defines its metadata
 */
export function Module(metadata?: ModuleDecoratorOptions): ClassDecorator {
  return function(target: any) {
    const providers = (metadata?.providers || []).map((cls: any) => {
      const deps = cls[INJECT_DEPS_KEY]?.sort((a: any, b: any) => a.index - b.index).map((d: any) => d.token) ?? [];

      return {
        name: cls.name,
        deps,
        scope: cls.__scope ?? 'singleton',
      } as InjectableMetadata;
    });

    metadataRegistry.modules.push({
      name: target.name,
      providers,
      controllers: metadata?.controllers ?? [],
      imports: metadata?.imports ?? [],
      exports: metadata?.exports ?? [],
    });
  };
}

/**
 * Injectable Decorator
 * Marks a class as an injectable and defines its metadata
 */
export function Injectable(metadata?: InjectableDecoratorOptions): ClassDecorator {
  return function(target: any) {
    const deps = target[INJECT_DEPS_KEY]?.sort((a: any, b: any) => a.index - b.index).map((d: any) => d.token) || [];
    const scope = metadata?.scope || 'singleton';

    metadataRegistry.providers.push({
      name: target.name,
      deps,
      scope,
    });
  };
}
