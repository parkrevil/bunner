import type { GenerateId } from './types';

export interface RequestIdOptions {
  header?: string;
  generator?: GenerateId;
  trustHeader?: boolean;
  setHeader?: boolean;
}
