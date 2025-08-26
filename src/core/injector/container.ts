import type { OnApplicationShutdown, OnModuleInit } from '../../interfaces';
import { InjectDecorator, ModuleDecorator } from './constants';
import { isConstructor, isForwardRef } from './helpers';
import type { ModuleMetadata } from './interfaces';
import { ModuleContainer } from './module-container';
import type { Constructor } from './types';

export class Container {
  private static instance: Container;
  private injectables = new Map<Constructor, InstanceType<Constructor>>();
  private controllers = new Map<Constructor, InstanceType<Constructor>>();
  private modules = new Map<Constructor, ModuleContainer>();

  /**
   * Get the singleton instance of the container
   * @returns The singleton instance of the container
   */
  static getInstance() {
    if (!Container.instance) {
      Container.instance = new Container();
    }

    return Container.instance;
  }

  /**
   * Register a module
   * @param cls - The module class to register
   * @param parentModule - Optional parent module for hierarchy
   */
  registerModule(cls: Constructor, parentModule?: ModuleContainer): ModuleContainer {
    if (this.modules.has(cls)) {
      return this.modules.get(cls)!;
    }

    const metadata = Reflect.getMetadata(ModuleDecorator, cls) as ModuleMetadata;
    if (!metadata) {
      throw new Error(`Module ${cls.name} must have @Module decorator`);
    }

    const module = new ModuleContainer(cls, metadata, parentModule);
    this.modules.set(cls, module);

    const importedContainers: ModuleContainer[] = [];
    for (const imp of metadata.imports ?? []) {
      const importedClass = isForwardRef(imp as any) ? (imp as any).forwardRef() : (imp as Constructor);
      const imported = this.registerModule(importedClass, module);
      importedContainers.push(imported);
    }

    module.setImportedModules(importedContainers);
    module.initialize();

    return module;
  }

  private async invokeModuleInit(module: ModuleContainer) {
    const controllers = module.getControllers();
    for (const instance of controllers.values()) {
      if (typeof (instance as any).onModuleInit === 'function') {
        await (instance as unknown as OnModuleInit).onModuleInit();
      }
    }

    const providers = module.getProviders();
    for (const instance of providers.values()) {
      if (typeof (instance as any).onModuleInit === 'function') {
        await (instance as unknown as OnModuleInit).onModuleInit();
      }
    }
  }

  /**
   * Invoke onModuleInit across all registered modules
   */
  async invokeOnModuleInit() {
    for (const module of this.modules.values()) {
      await this.invokeModuleInit(module);
    }
  }

  async invokeApplicationShutdown(signal?: string | number) {
    // Iterate over all modules and call onApplicationShutdown if present
    for (const module of this.modules.values()) {
      const controllers = module.getControllers();
      for (const instance of controllers.values()) {
        if (typeof (instance as any).onApplicationShutdown === 'function') {
          await (instance as unknown as OnApplicationShutdown).onApplicationShutdown(signal);
        }
      }

      const providers = module.getProviders();
      for (const instance of providers.values()) {
        if (typeof (instance as any).onApplicationShutdown === 'function') {
          await (instance as unknown as OnApplicationShutdown).onApplicationShutdown(signal);
        }
      }
    }
  }

  /**
   * Register an injectable class (backward compatibility)
   * @param cls - The class to register
   */
  registerInjectable<T extends Constructor>(cls: T) {
    const dependencies = this.resolveDependencies(cls);
    const instance = new cls(...dependencies);

    this.injectables.set(cls, instance);
  }

  /**
   * Register a controller class (backward compatibility)
   * @param cls - The class to register
   */
  registerController<T extends Constructor>(cls: T) {
    const dependencies = this.resolveDependencies(cls);
    const instance = new cls(...dependencies);

    this.controllers.set(cls, instance);
  }

  /**
   * Resolve dependencies for a class
   * @param cls - The class to resolve dependencies for
   */
  private resolveDependencies(cls: Constructor): any[] {
    const paramtypes = Reflect.getMetadata('design:paramtypes', cls) || [];
    const tokens: any[] = Reflect.getOwnMetadata(InjectDecorator, cls) || [];

    return paramtypes.map((paramtype: any, index: number) => {
      const token = tokens[index] ?? paramtype;

      if (!token) {
        throw new Error(`Cannot resolve dependency for ${cls.name}. Type information is missing.`);
      }

      const target = isForwardRef(token) ? token.forwardRef() : token;

      if (!isConstructor(target)) {
        throw new Error(`Cannot inject primitive type ${String(target)} into ${cls.name}`);
      }

      for (const module of this.modules.values()) {
        try {
          return module.resolve(target);
        } catch {
        }
      }

      if (!this.injectables.has(target)) {
        this.registerInjectable(target as Constructor);
      }

      return this.injectables.get(target as Constructor);
    });
  }

  /**
   * Get all registered controllers
   * @returns A map of controller classes and their instances
   */
  getControllers() {
    const allControllers = new Map<Constructor, InstanceType<Constructor>>();

    for (const module of this.modules.values()) {
      const moduleControllers = module.getControllers();
      for (const [key, value] of moduleControllers) {
        allControllers.set(key, value);
      }
    }

    for (const [key, value] of this.controllers) {
      allControllers.set(key, value);
    }

    return allControllers;
  }

  /**
   * Get all modules
   * @returns A map of module classes and their instances
   */
  getModules() {
    return this.modules;
  }
}

export const container = Container.getInstance();