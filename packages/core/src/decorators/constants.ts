import type { InjectableMetadata, ModuleMetadata } from './interfaces';

export const metadataRegistry: {
  modules: ModuleMetadata[];
  providers: InjectableMetadata[];
  controllers: any[];
} = {
  modules: [],
  providers: [],
  controllers: [],
};

export const INJECT_DEPS_KEY = '__inject_deps__';
export const PARAM_METADATA_KEY = '__params__';