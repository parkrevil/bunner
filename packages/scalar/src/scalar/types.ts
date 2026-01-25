import type { AdapterCollection } from '@bunner/common';

export type DocumentTargets = 'all' | DocumentTarget[];

export interface DocumentTarget {
  protocol: string;
  names?: string[];
}

export type HttpTargets = 'all' | string[];

export type AdapterCollectionLike = AdapterCollection;

export type ScalarValue = string | number | boolean | bigint | symbol | null | undefined;

export type ScalarList = ScalarValue[];

export type ScalarShallowRecord = Record<string, ScalarValue | ScalarList>;

export type ScalarObjectList = ScalarShallowRecord[];

export type ScalarRecord = Record<string, ScalarValue | ScalarList | ScalarObjectList | ScalarShallowRecord>;

export type ScalarNode = ScalarValue | ScalarList | ScalarRecord | ScalarObjectList;

export type ScalarKey = string | symbol;

export type ScalarKeyedRecord = Record<ScalarKey, ScalarNode | ScalarCallable>;

export type ScalarCallable = (...args: ScalarList) => ScalarValue;

export type ScalarInput = ScalarNode | ScalarCallable;

export type ScalarConstructor = new (...args: ScalarList) => ScalarRecord;

export type ScalarRegistryKey = ScalarConstructor | ScalarCallable | string | symbol;

export type ScalarMetadataRegistry = Map<ScalarRegistryKey, ScalarRecord>;
