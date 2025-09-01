import type { ModuleController, ModuleExport, ModuleImport, ModuleProvider, ProviderScope } from './types';


/**
 * Module decorator options
 * @description The metadata for a module
 */
export interface ModuleDecoratorOptions {
  providers?: ModuleProvider[];
  controllers?: ModuleController[];
  imports?: ModuleImport[];
  exports?: ModuleExport[];
}

/**
 * Module decorator metadata
 * @description The metadata for a module
 */
export interface ModuleMetadata {
  name: string;
  providers: InjectableMetadata[];
  controllers: ModuleController[];
  imports: ModuleImport[];
  exports: ModuleExport[];
}

/**
 * Injectable decorator options
 * @description The metadata for an injectable
 */
export interface InjectableDecoratorOptions {
  scope?: ProviderScope;
}

/**
 * Injectable Metadata
 * @description The metadata for an injectable
 */
export interface InjectableMetadata extends InjectableDecoratorOptions {
  name: string;
  deps: string[];
}
