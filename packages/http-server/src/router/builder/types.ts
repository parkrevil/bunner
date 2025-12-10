import type { HttpMethod } from '../../types';
import type { RegexSafetyOptions } from '../types';

import { OptionalParamDefaults } from './optional-param-defaults';

export interface BuilderConfig {
  regexSafety?: RegexSafetyOptions;
  regexAnchorPolicy?: 'warn' | 'error' | 'silent';
  optionalParamDefaults?: OptionalParamDefaults;
  strictParamNames?: boolean;
}

export interface RouteMethods {
  byMethod: Map<HttpMethod, number>;
}

export interface SortedChildArrays {
  segments: string[];
  nodes: any[]; // Using any to avoid circular dependency with Node. Casting used in Store.
  fingerprints: number[];
}
