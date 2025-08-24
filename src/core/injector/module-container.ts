import { InjectDecorator } from './constants';
import { resolveTokenTarget } from './helpers';
import type { ModuleMetadata } from './interfaces';
import type { Constructor } from './types';

/**
 * Module container class for managing dependency injection scope
 */
export class ModuleContainer {
  private providers = new Map<Constructor, InstanceType<Constructor>>();
  private controllers = new Map<Constructor, InstanceType<Constructor>>();
  private exports = new Set<Constructor>();
  private parentModule?: ModuleContainer;
  private importedModules: ModuleContainer[] = [];
  private constructing = new Set<Constructor>();
  private proxies = new Map<Constructor, any>();
  private proxyTargets = new Map<Constructor, any>();
  private controllersInitialized = false;

  constructor(
    private readonly moduleClass: Constructor,
    private readonly metadata: ModuleMetadata,
    parentModule?: ModuleContainer
  ) {
    this.parentModule = parentModule;
  }

  /**
   * Initialize the module with its metadata
   */
  initialize() {
    if (this.metadata.exports) {
      this.metadata.exports.forEach(exported => {
        this.exports.add(exported);
      });
    }
  }

  /**
   * Set imported modules for this module
   */
  setImportedModules(modules: ModuleContainer[]) {
    this.importedModules = modules;
  }

  /**
   * Register a provider in this module
   */
  registerProvider<T extends Constructor>(cls: T): InstanceType<T> {
    if (this.providers.has(cls)) {
      return this.providers.get(cls) as InstanceType<T>;
    }

    if (this.constructing.has(cls)) {
      return this.getOrCreateProxy(cls);
    }

    this.constructing.add(cls);

    const dependencies = this.resolveDependencies(cls);
    const instance = new cls(...dependencies);

    this.providers.set(cls, instance);
    this.constructing.delete(cls);

    if (this.proxies.has(cls)) {
      this.proxyTargets.set(cls, instance);
    }

    return instance;
  }

  /**
   * Register a controller in this module
   */
  registerController<T extends Constructor>(cls: T): InstanceType<T> {
    if (this.controllers.has(cls)) {
      return this.controllers.get(cls) as InstanceType<T>;
    }

    const dependencies = this.resolveDependencies(cls);
    const instance = new cls(...dependencies);
    this.controllers.set(cls, instance);

    return instance;
  }

  /**
   * Resolve dependencies for a class
   */
  private resolveDependencies(cls: Constructor): any[] {
    const paramtypes = Reflect.getMetadata('design:paramtypes', cls) || [];
    const tokens: any[] = Reflect.getOwnMetadata(InjectDecorator, cls) || [];

    return paramtypes.map((paramtype: any, index: number) => {
      const token = tokens[index] ?? paramtype;
      const target = resolveTokenTarget(token);

      const resolved = this.tryResolve(target);
      if (resolved !== undefined) {
        return resolved;
      }

      throw new Error(`Cannot resolve dependency ${String((target as any).name || target)} for ${cls.name}`);
    });
  }

  /**
   * Attempt to resolve a dependency across this module, its imports, and its parents
   */
  private tryResolve<T>(cls: Constructor, visited: Set<ModuleContainer> = new Set()): T | undefined {
    if (visited.has(this)) {
      return undefined;
    }
    visited.add(this);

    if ((this.metadata.providers || []).includes(cls)) {
      return this.registerProvider(cls) as T;
    }

    const provided = this.providers.get(cls);
    if (provided) {
      return provided as T;
    }

    if (this.constructing.has(cls)) {
      return this.getOrCreateProxy(cls);
    }

    for (const imported of this.importedModules) {
      const resolved = imported.tryResolve<T>(cls, visited);
      if (resolved !== undefined) {
        return resolved;
      }
    }

    if (this.parentModule) {
      return this.parentModule.tryResolve<T>(cls, visited);
    }

    return undefined;
  }

  /**
   * Create or get a proxy for a circular dependency under construction
   */
  private getOrCreateProxy<T>(cls: Constructor<T>): T {
    if (this.proxies.has(cls)) {
      return this.proxies.get(cls);
    }

    const handler: ProxyHandler<any> = {
      get: (_t, p) => {
        const real = this.proxyTargets.get(cls);
        if (!real) {
          throw new Error(`Circular dependency proxy for ${cls.name} accessed before initialization`);
        }
        const v = (real as any)[p];
        return typeof v === 'function' ? v.bind(real) : v;
      },
      set: (_t, p, v) => {
        const real = this.proxyTargets.get(cls);
        if (!real) {
          throw new Error(`Circular dependency proxy for ${cls.name} accessed before initialization`);
        }
        (real as any)[p] = v;
        return true;
      },
    };

    const proxy = new Proxy({}, handler);
    this.proxies.set(cls, proxy);
    return proxy;
  }

  /**
   * Resolve a dependency from this module or parent modules
   */
  resolve<T>(cls: Constructor): T {
    const resolved = this.tryResolve<T>(cls);
    if (resolved !== undefined) {
      return resolved;
    }
    throw new Error(`Cannot resolve ${cls.name} - not found in module hierarchy`);
  }

  /**
   * Get all registered controllers
   */
  getControllers() {
    if (!this.controllersInitialized) {
      (this.metadata.controllers || []).forEach(c => this.registerController(c));
      this.controllersInitialized = true;
    }
    return this.controllers;
  }

  /**
   * Get all exported providers
   */
  getExports() {
    const exportedInstances = new Map<Constructor, InstanceType<Constructor>>();

    this.exports.forEach(exportedClass => {
      if (this.providers.has(exportedClass)) {
        exportedInstances.set(exportedClass, this.providers.get(exportedClass)!);
      }
    });

    return exportedInstances;
  }

  /**
   * Check if a class is exported by this module
   */
  exportsHas(cls: Constructor) {
    if (this.exports.has(cls)) {
      return true;
    }

    for (const imported of this.importedModules) {
      if (!this.exports.has(imported.moduleClass)) {
        continue;
      }
      if (imported.exportsHas(cls)) {
        return true;
      }
    }

    return false;
  }
}
