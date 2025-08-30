import type { ModuleController, ModuleExport, ModuleImport, ModuleProvider } from './types';

/**
 * Injectable Metadata
 * @description The metadata for an injectable
 */
export interface InjectableMetadata {
  scope?: 'singleton' | 'transient' | 'request';
}

/**
 * Module Metadata
 * @description The metadata for a module
 */
export interface ModuleMetadata {
  providers?: ModuleProvider[];
  controllers?: ModuleController[];
  imports?: ModuleImport[];
  exports?: ModuleExport[];
}
