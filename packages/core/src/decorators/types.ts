import type { Class } from '../types';

/**
 * Module Provider
 * @description The provider for a module
 */
export type ModuleProvider = Class;

/**
 * Module Controller
 * @description The controller for a module
 */
export type ModuleController = Class;

/**
 * Module Import
 * @description The import for a module
 */
export type ModuleImport = Class;

/**
 * Module Export
 * @description The export for a module
 */
export type ModuleExport = Class;

/**
 * Provider Scope
 * @description The scope for a provider
 */
export type ProviderScope = 'singleton' | 'transient' | 'request';