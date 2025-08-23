import { isConstructor } from './helpers';
import type { Constructor } from './types';

export class Container {
  private static instance: Container;
  private injectables = new Map<Constructor, InstanceType<Constructor>>();
  private controllers = new Map<Constructor, InstanceType<Constructor>>();

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
   * Register an injectable class
   * @param cls - The class to register
   */
  registerInjectable<T extends Constructor>(cls: T) {
    const dependencies = this.resolveDependencies(cls);
    const instance = new cls(...dependencies);

    this.injectables.set(cls, instance);
  }

  /**
   * Register a controller class
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

    return paramtypes.map((paramtype: any) => {
      if (!paramtype) {
        throw new Error(`Cannot resolve dependency for ${cls.name}. Type information is missing.`);
      }

      if (!isConstructor(paramtype)) {
        throw new Error(`Cannot inject primitive type ${paramtype.name} into ${cls.name}`);
      }

      if (!this.injectables.has(paramtype)) {
        this.registerInjectable(paramtype);
      }

      return this.injectables.get(paramtype);
    });
  }

  /**
   * Get all registered controllers
   * @returns A map of controller classes and their instances
   */
  getControllers() {
    return this.controllers;
  }
}

export const container = Container.getInstance();