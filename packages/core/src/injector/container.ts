import { isClass } from '../helpers';
import type { BunnerRootModule } from '../interfaces';
import type { Class } from '../types';

import { MetadataKey, ReflectMetadataKey } from './constants';
import {
  isForwardRef,
  isUseClassProvider,
  isUseExistingProvider,
  isUseFactoryProvider,
  isUseValueProvider,
} from './helpers';
import type {
  DependencyGraphController,
  DependencyGraphModule,
  DependencyGraphProvider,
  InjectMetadata,
} from './interfaces';
import type {
  DependencyGraphNode,
  DependencyProvider,
  InjectableMetadata,
  ModuleMetadata,
  Provider,
  ProviderToken,
} from './types';

/**
 * Container
 * @description Dependency injection container for each application
 */
export class Container {
  private readonly rootModuleCls: Class<BunnerRootModule>;
  private readonly graph: Map<Class | ProviderToken, DependencyGraphNode>;
  private readonly modules: Map<Class, object>;
  private readonly providers: Map<ProviderToken, object>;
  private readonly controllers: Map<Class, object>;

  constructor(rootModuleCls: Class<BunnerRootModule>) {
    this.rootModuleCls = rootModuleCls;
    this.graph = new Map<Class, DependencyGraphNode>();
    this.modules = new Map<Class, object>();
    this.providers = new Map<ProviderToken, object>();
    this.controllers = new Map<Class, object>();
  }

  /**
   * Initialize the container and build dependency graph
   */
  async init() {
    console.log('🔧 Building dependency graph...');

    this.buildGraph();
    await this.resolveModule(this.rootModuleCls);

    console.log('✅ Dependency graph built and resolved');
  }

  /**
   * Build the dependency graph
   */
  private buildGraph() {
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

    const metadata: ModuleMetadata = Reflect.getMetadata(
      MetadataKey.Module,
      cls,
    );

    if (!metadata) {
      throw new Error(
        `Module ${cls.name} does not have a @Module() decorator.`,
      );
    }

    this.graph.set(cls, {
      type: 'module',
      ...metadata,
    });

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
      throw new Error(`Invalid provider: ${JSON.stringify(provider)}`);
    }

    if (this.graph.has(token)) {
      return;
    }

    const node: DependencyGraphProvider = {
      type: 'provider',
      provider,
      dependencies,
      scope: undefined,
    };

    if (cls) {
      const injectableMetadata: InjectableMetadata = Reflect.getMetadata(
        MetadataKey.Injectable,
        cls,
      );

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
      type: 'controller',
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
    const paramTypes = Reflect.getMetadata(
      ReflectMetadataKey.DesignParamtypes,
      cls,
    );

    if (!paramTypes) {
      return [];
    }

    const injectParams: InjectMetadata[] =
      Reflect.getMetadata(MetadataKey.Inject, cls) ?? [];
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

  /**
   * Resolve the module
   * @param moduleCls
   * @returns
   */
  private async resolveModule(moduleCls: Class) {
    let module = this.modules.get(moduleCls);

    if (module) {
      return module;
    }

    module = new moduleCls();

    this.modules.set(moduleCls, module!);

    const node: DependencyGraphModule = this.graph.get(
      moduleCls,
    ) as DependencyGraphModule;

    for (const importedCls of node.imports) {
      await this.resolveModule(importedCls);
    }

    for (const controllerCls of node.controllers) {
      await this.resolveController(controllerCls);
    }

    return module;
  }

  /**
   * Resolve the controller
   * @param cls
   * @returns
   */
  private async resolveController(cls: Class) {
    let instance = this.controllers.get(cls);

    if (instance) {
      return instance;
    }

    const node: DependencyGraphController = this.graph.get(
      cls,
    ) as DependencyGraphController;
    const dependencies = await Promise.all(
      node.dependencies.map(dependency =>
        this.resolveProvider(
          isForwardRef(dependency) ? dependency.forwardRef() : dependency,
        ),
      ),
    );

    instance = new cls(...dependencies);

    this.controllers.set(cls, instance!);

    return instance;
  }

  /**
   * Resolve the provider
   * @param token
   * @returns
   */
  private async resolveProvider(token: ProviderToken): Promise<any> {
    let instance: any = this.providers.get(token);

    if (instance) {
      return instance;
    }

    const node: DependencyGraphProvider = this.graph.get(
      token,
    ) as DependencyGraphProvider;
    const provider = node.provider;
    let dependencies: any[] = [];

    if (isClass(provider) || isUseClassProvider(provider)) {
      const cls = isUseClassProvider(provider) ? provider.useClass : provider;

      dependencies = await Promise.all(
        node.dependencies.map(dep => {
          if (isForwardRef(dep)) {
            return this.resolveProvider(dep.forwardRef());
          }

          return this.resolveProvider(dep);
        }),
      );
      instance = new cls(...dependencies);
    } else if (isUseExistingProvider(provider)) {
      instance = await this.resolveProvider(provider.useExisting);
    } else if (isUseFactoryProvider(provider)) {
      dependencies = await Promise.all(
        (provider.inject ?? []).map(r => this.resolveProvider(r)),
      );
      instance = await provider.useFactory(...dependencies);
    } else if (isUseValueProvider(provider)) {
      instance = provider.useValue;
    } else {
      throw new Error(`Invalid provider: ${provider as string}`);
    }

    if (node.scope === undefined || node.scope === 'singleton') {
      this.providers.set(token, instance);
    }

    return instance;
  }
}
