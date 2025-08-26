import type { ClassType } from '../../types';
import type { ProviderDescriptor, ServiceIdentifier } from './types';

export interface DynamicModule {
  module: ClassType;
  imports?: ModuleImport[];
  providers?: ProviderDescriptor[];
  controllers?: ClassType[];
  exports?: ServiceIdentifier[];
}

export type ModuleOrDynamic = ClassType | DynamicModule;

export type ModuleImport =
  | ModuleOrDynamic
  | Promise<ModuleOrDynamic>
  | (() => ModuleOrDynamic | Promise<ModuleOrDynamic>);

export interface ModuleMetadata {
  providers?: ProviderDescriptor[];
  controllers?: ClassType[];
  imports?: ModuleImport[];
  exports?: ServiceIdentifier[];
}
