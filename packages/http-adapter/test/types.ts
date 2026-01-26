import type { BunnerContainer } from '@bunner/common';

import type { ClassMetadata, MetadataRegistryKey } from '../src/types';

export type TestMetadataRegistry = Map<MetadataRegistryKey, ClassMetadata>;

export type TestProviderValue = ReturnType<BunnerContainer['get']>;
