import type { ClassType } from '../../types';
import type { ModuleImport, ProviderDescriptor, ServiceIdentifier } from './types';

export interface DynamicModule {
  module: ClassType;
  imports?: ModuleImport[];
  providers?: ProviderDescriptor[];
  controllers?: ClassType[];
  exports?: ServiceIdentifier[];
}

export interface ModuleMetadata {
  providers?: ProviderDescriptor[];
  controllers?: ClassType[];
  imports?: ModuleImport[];
  exports?: ServiceIdentifier[];
}
