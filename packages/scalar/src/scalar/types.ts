import type { AdapterCollection } from '@bunner/common';

export type DocumentTargets =
  | 'all'
  | Array<{
      protocol: string;
      names?: string[];
    }>;

export type HttpTargets = 'all' | string[];

export type AdapterCollectionLike = AdapterCollection;
