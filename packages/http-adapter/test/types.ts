import type { BunnerValue } from '@bunner/common';
import type { CombinedMetadataInput } from '../../core/src/metadata/interfaces';
import type { ClassMetadata, MetadataRegistryKey } from '../src/types';

export type TestMetadataRegistry = Map<MetadataRegistryKey, ClassMetadata | CombinedMetadataInput>;

export type TestProviderValue = BunnerValue;
