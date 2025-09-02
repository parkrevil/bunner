import type { InjectableDecoratorOptions, ModuleDecoratorOptions } from '../decorators';
import type { Class } from '../types';
import type { ProviderUseValue, ProviderUseClass, ProviderUseExists, ProviderUseFactory, DependencyGraphControllerNode, DependencyGraphProviderNode, DependencyGraphModuleNode } from './interfaces';

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

/**
 * Module decorator metadata
 * @description The metadata for a module
 */
export type ModuleMetadata = Required<ModuleDecoratorOptions>;

/**
 * Injectable Metadata
 * @description The metadata for an injectable
 */
export type InjectableMetadata = Required<InjectableDecoratorOptions>;

/**
 * Module Exports Type
 * @description The type for a module exports
 */
export type ModuleExportsType = Class | ProviderToken;

/**
 * Dependency Graph Node
 * @description The node for a dependency graph
 */
export type DependencyGraphNode = DependencyGraphModuleNode | DependencyGraphProviderNode | DependencyGraphControllerNode;
