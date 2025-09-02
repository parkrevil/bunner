import { isClass } from '../helpers';
import type { BunnerRootModule } from '../interfaces';
import type { Class } from '../types';
import { MetadataKey, ReflectMetadataKey } from './constants';
import { isForwardRef, isUseClassProvider, isUseExistingProvider, isUseFactoryProvider, isUseValueProvider } from './helpers';
import type { DependencyGraphController, DependencyGraphProvider, InjectMetadata } from './interfaces';
import type { DependencyGraphNode, DependencyProvider, InjectableMetadata, ModuleMetadata, Provider, ProviderToken } from './types';

/**
 * Container
 * @description Dependency injection container for each application
 */
export class Container {
  private rootModuleCls: Class<BunnerRootModule>;
  private graph: Map<Class | ProviderToken, DependencyGraphNode>;

  constructor(rootModuleCls: Class<BunnerRootModule>) {
    this.rootModuleCls = rootModuleCls;
    this.graph = new Map<Class, DependencyGraphNode>();
  }

  /**
   * Initialize the container and build dependency graph
   */
  async init() {
    console.log('🔧 Building dependency graph...');
    
    this.buildGraph();

    console.log(this.graph);
    
    console.log('✅ Dependency graph built and resolved');
  }

  /**
   * Build the dependency graph
   */
  private async buildGraph() {
    this.exploreModule(this.rootModuleCls);
  }
  
  /**
   * Explore the module
   * @param cls 
   * @returns 
   */
  private exploreModule(cls: Class) {
    if (this.graph.has(cls)) {
      return;
    }

    const metadata: ModuleMetadata = Reflect.getMetadata(MetadataKey.Module, cls);

    if (!metadata) {
      throw new Error(`Module ${cls.name} does not have a @Module() decorator.`);
    }

    this.graph.set(cls, metadata);

    for (const importedCls of metadata.imports) {
      this.exploreModule(importedCls);
    }

    for (const controller of metadata.controllers) {
      this.exploreController(controller);
    }

    for (const provider of metadata.providers) {
      this.exploreProvider(provider);
    }
  }

  /**
   * Explore the provider
   * @param cls 
   */
  private exploreProvider(provider: Provider) {
    let token: ProviderToken;
    let dependencies: DependencyProvider[];
    let cls: Class | undefined;

    if (isClass(provider)) {
      token = provider;
      cls = provider;
      dependencies = this.getDependenciesFromConstructor(provider);
    } else if (isUseClassProvider(provider)) {
      token = provider.token;
      cls = provider.useClass;
      dependencies = this.getDependenciesFromConstructor(provider.useClass);
    } else if (isUseExistingProvider(provider)) {
      token = provider.token;
      cls = provider.useExisting;
      dependencies = this.getDependenciesFromConstructor(provider.useExisting);
    } else if (isUseFactoryProvider(provider)) {
      token = provider.token;
      dependencies = provider.inject ?? [];
    } else if (isUseValueProvider(provider)) {
      token = provider.token;
      dependencies = [];
    } else {
      throw new Error(`Invalid provider: ${provider}`);
    }

    if (this.graph.has(token)) {
      return;
    }

    const node: DependencyGraphProvider = {
      provider,
      dependencies,
      scope: undefined,
    };

    if (cls) {
      const injectableMetadata: InjectableMetadata = Reflect.getMetadata(MetadataKey.Injectable, cls);

      if (injectableMetadata) {
        node.scope = injectableMetadata.scope;
      }
    }

    this.graph.set(token, node);

    for (const dependency of dependencies) {
      if (!isClass(dependency)) {
        continue;
      }

      this.exploreProvider(dependency);
    }
  }

  private exploreController(cls: Class) {
    const dependencies = this.getDependenciesFromConstructor(cls);

    this.graph.set(cls, {
      dependencies,
    } as DependencyGraphController);

    for (const dependency of dependencies) {
      this.exploreProvider(dependency as Provider);
    }
  }

  /**
   * Get the dependencies from the params
   * @param cls 
   * @returns 
   */
  private getDependenciesFromConstructor(cls: Class) {
    const paramTypes = Reflect.getMetadata(ReflectMetadataKey.DesignParamtypes, cls);

    if (!paramTypes) {
      return [];
    }

    const injectParams: InjectMetadata[] = Reflect.getMetadata(MetadataKey.Inject, cls) ?? [];
    const dependencies: DependencyProvider[] = [];

    for (let i = 0; i < paramTypes.length; i++) {
      const injectedParam = injectParams.find(p => p.index === i);
      
      if (!injectedParam) {
        dependencies.push(paramTypes[i]);

        continue;
      }

      if (isForwardRef(injectedParam.token)) {
        dependencies.push(injectedParam.token);
      } else {
        dependencies.push(injectedParam.token);
      }
    }

    return dependencies;
  }
}
