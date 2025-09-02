import type { Class } from '../types';
import type { ProviderUseValue, ProviderUseClass, ProviderUseExists, ProviderUseFactory } from './interfaces';

/**
 * Provider Scope
 * @description The scope for a provider
 */
export type ProviderScope = 'singleton' | 'transient' | 'request';

/**
 * Provider Token
 * @description The token for a provider
 */
export type ProviderToken = string | symbol | Class;

/**
 * Provider Type
 * @description The type for a provider
 */
export type ProviderType = Class | ProviderUseValue | ProviderUseClass | ProviderUseExists | ProviderUseFactory;
