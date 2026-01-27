import type { Class, ProviderToken } from '@bunner/common';

import type { Container } from '../injector/container';
import type { ClassMetadata } from '../injector/types';

export interface RuntimeContext {
  metadataRegistry?: Map<Class, ClassMetadata>;
  scopedKeys?: Map<ProviderToken, string>;
  container?: Container;
  isAotRuntime?: boolean;
}
