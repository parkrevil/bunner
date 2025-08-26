import { ContainerModule, Container as InversifyContainer } from 'inversify';
import type { ClassType } from '../../types';
import { ModuleDecorator } from './constants';
import type { ModuleMetadata } from './interfaces';
import type { ProviderDescriptor } from './types';

/**
 * AppContainer
 * Maintains a single Inversify container per application and orchestrates
 * module registration, controller/provider bindings, and lifecycle hooks.
 */
export class AppContainer {
  private readonly container: InversifyContainer;
  private readonly moduleClasses: Set<ClassType>;
  private readonly controllerClasses: Set<ClassType>;
  private readonly providerClasses: Set<ClassType>;

  constructor() {
    this.container = new InversifyContainer({ defaultScope: 'Singleton' });
    this.moduleClasses = new Set<ClassType>();
    this.controllerClasses = new Set<ClassType>();
    this.providerClasses = new Set<ClassType>();
  }

  /**
   * Register a module and its imports into the DI container.
   * Supports lazy import functions to avoid TDZ/cycles and binds
   * providers/controllers with appropriate scopes.
   */
  registerModule(moduleClass: ClassType) {
    if (this.moduleClasses.has(moduleClass)) {
      return;
    }

    const metadata = Reflect.getMetadata(ModuleDecorator, moduleClass) as ModuleMetadata;

    if (!metadata) {
      throw new Error(`Module ${moduleClass.name} must have @Module decorator`);
    }

    this.moduleClasses.add(moduleClass);

    for (const importEntry of metadata.imports ?? []) {
      const importedModuleClass = (typeof importEntry === 'function' && (importEntry as any).prototype === undefined)
        ? (importEntry as () => ClassType)()
        : (importEntry as ClassType);

      this.registerModule(importedModuleClass);
    }

    const containerModule = new ContainerModule((loadOptions) => {
      const { bind } = loadOptions;

      for (const providerEntry of metadata.providers ?? []) {
        const providerDescriptor = providerEntry as ProviderDescriptor;

        if (typeof providerDescriptor === 'function') {
          bind(providerDescriptor).toSelf().inSingletonScope();

          const className = (providerDescriptor as any).name || 'Anonymous';
          const factoryToken = Symbol.for(`Factory:${className}`);
          (bind as any)(factoryToken).toFactory((ctx: any) => () => (ctx.container as InversifyContainer).get(providerDescriptor));

          this.providerClasses.add(providerDescriptor);

          continue;
        }

        const serviceIdentifier = providerDescriptor.provide;
        const implementationClass = providerDescriptor.useClass ?? providerDescriptor.provide;
        const binding = bind(serviceIdentifier).to(implementationClass as any);
        const factoryToken = Symbol.for(`Factory:${(implementationClass as any).name || 'Anonymous'}`);

        (bind as any)(factoryToken).toFactory((ctx: any) => () => (ctx.container as InversifyContainer).get(serviceIdentifier));

        switch (providerDescriptor.scope) {
          case 'Transient':
            binding.inTransientScope();
            break;
          case 'Request':
            binding.inRequestScope();
            break;
          default:
            binding.inSingletonScope();
        }

        this.providerClasses.add(serviceIdentifier);
      }

      for (const controllerClass of metadata.controllers ?? []) {
        bind(controllerClass).toSelf().inSingletonScope();

        this.controllerClasses.add(controllerClass);
      }
    });

    this.container.load(containerModule);
  }

  /**
   * Return module classes without resolving instances (avoid eager DI/cycles).
   * @returns module classes
   */
  getModuleClasses() {
    return Array.from(this.moduleClasses);
  }

  /**
   * Return provider classes without resolving instances (avoid eager DI/cycles).
   * @returns provider classes
   */
  getProviderClasses() {
    return Array.from(this.providerClasses);
  }

  /**
   * Return controller classes without resolving instances (avoid eager DI/cycles).
   * @returns controller classes
   */
  getControllerClasses() {
    return Array.from(this.controllerClasses);
  }

  /**
   * Get a service from the container.
   * @param id - The service identifier.
   * @returns The service.
   */
  async loadAndGetAll() {
    const [moduleInstances, providerInstances, controllerInstances] = await Promise.all([
      Promise.all(this.getModuleClasses().map(r => this.container.getAsync(r).catch(() => undefined))),
      Promise.all(this.getProviderClasses().map(r => this.container.getAsync(r).catch(() => undefined))),
      Promise.all(this.getControllerClasses().map(r => this.container.getAsync(r).catch(() => undefined))),
    ]);

    return {
      modules: moduleInstances.filter(Boolean),
      providers: providerInstances.filter(Boolean),
      controllers: controllerInstances.filter(Boolean),
    };
  }

  /**
   * Create a request-scoped child container.
   */
  createRequestContainer() {
    return new InversifyContainer({ parent: this.container, defaultScope: 'Request' });
  }
}