import type { ClassType } from '../../types';
import type { ProviderDescriptor } from './types';

export type ModuleImport = ClassType | (() => ClassType);

export interface ModuleMetadata {
  providers?: ProviderDescriptor[];
  controllers?: ClassType[];
  imports?: ModuleImport[];
  exports?: ClassType[];
}
