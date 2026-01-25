import type { BunnerContainer, Class, ProviderToken } from '@bunner/common';

import type { ClassMetadata } from '../injector/types';

export interface RuntimeContext {
  metadataRegistry?: Map<Class, ClassMetadata>;
  scopedKeys?: Map<ProviderToken, string>;
  container?: BunnerContainer;
  isAotRuntime?: boolean;
}
