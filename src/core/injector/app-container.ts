import { ContainerModule, Container as InversifyContainer } from 'inversify';
import type { ClassType } from '../../types';
import { ModuleDecorator } from './constants';
import type { DynamicModule, ModuleMetadata } from './interfaces';
import { RequestContext } from './request-context';
import type { ProviderDescriptor, ProviderScope, ServiceIdentifier } from './types';

/**
 * AppContainer
 * Maintains a single Inversify container per application and orchestrates
 * module registration, controller/provider bindings, and lifecycle hooks.
 */
export class AppContainer {
  private readonly container: InversifyContainer;
  private readonly moduleClasses: Set<ClassType>;
  private readonly controllerClasses: Set<ClassType>;
  private readonly providerClasses: Set<ServiceIdentifier>;
  private readonly providerScopes: Map<ServiceIdentifier, ProviderScope>;
  private readonly classToFactoryToken: WeakMap<Function, symbol>;

  constructor() {
    this.container = new InversifyContainer({ defaultScope: 'Singleton' });
    this.moduleClasses = new Set<ClassType>();
    this.controllerClasses = new Set<ClassType>();
    this.providerClasses = new Set<ServiceIdentifier>();
    this.providerScopes = new Map<ServiceIdentifier, ProviderScope>();
    this.classToFactoryToken = new WeakMap<Function, symbol>();
  }

  /**
   * Expose container.get for selected internal usages (e.g., Router singleton resolution)
   */
  get<T>(id: any): T {
    return this.container.get<T>(id);
  }

  /**
   * Get unique and legacy factory tokens for a class reference.
   */
  private getFactoryTokensForClass(klass: Function) {
    let uniq = this.classToFactoryToken.get(klass);
    if (!uniq) {
      uniq = Symbol(`Factory:ref:${klass.name || 'Anonymous'}`);
      this.classToFactoryToken.set(klass, uniq);
    }

    const legacy = Symbol.for(`Factory:${klass.name || 'Anonymous'}`);
    const globalRef = Symbol.for(`Factory:ref:${klass.name || 'Anonymous'}`);

    return { uniq, legacy, globalRef } as const;
  }

  /**
   * Register a module and its imports into the DI container.
   * Supports lazy import functions to avoid TDZ/cycles and binds
   * providers/controllers with appropriate scopes.
   */
  async registerModule(moduleClassOrDynamic: ClassType | DynamicModule | Promise<ClassType | DynamicModule>) {
    if ((moduleClassOrDynamic as any) instanceof Promise) {
      moduleClassOrDynamic = await (moduleClassOrDynamic as any);
    }
    const moduleClass = (moduleClassOrDynamic as any).module ?? moduleClassOrDynamic as ClassType;

    if (this.moduleClasses.has(moduleClass)) {
      return;
    }

    const baseMeta = Reflect.getMetadata(ModuleDecorator, moduleClass) as ModuleMetadata;
    const dyn = (moduleClassOrDynamic as any).module ? (moduleClassOrDynamic as DynamicModule) : undefined;
    const metadata: ModuleMetadata = {
      providers: [...(baseMeta?.providers ?? []), ...(dyn?.providers ?? [])],
      controllers: [...(baseMeta?.controllers ?? []), ...(dyn?.controllers ?? [])],
      imports: [...(baseMeta?.imports ?? []), ...(dyn?.imports ?? [])],
      exports: [...(baseMeta?.exports ?? []), ...(dyn?.exports ?? [])] as ServiceIdentifier[],
    };

    if (!metadata) {
      throw new Error(`Module ${moduleClass.name} must have @Module decorator`);
    }

    this.moduleClasses.add(moduleClass);

    for (const importEntry of metadata.imports ?? []) {
      const resolved = typeof importEntry === 'function' && (importEntry as any).prototype === undefined
        ? (importEntry as any)()
        : importEntry;

      await this.registerModule(resolved as any);
    }

    const containerModuleFactory = async (loadOptions: any) => {
      const { bind } = loadOptions;

      for (const providerEntry of metadata.providers ?? []) {
        const providerDescriptor = providerEntry as ProviderDescriptor;

        if (typeof providerDescriptor === 'function') {
          if (this.container.isBound(providerDescriptor)) {
            this.container.unbind(providerDescriptor);
          }
          bind(providerDescriptor).toSelf().inSingletonScope();

          this.providerScopes.set(providerDescriptor, 'Singleton');

          const { uniq, legacy, globalRef } = this.getFactoryTokensForClass(providerDescriptor as any);
          const toFactory = (ctx: any) => () => {
            const current = RequestContext.getCurrentContainer() ?? (ctx.container as InversifyContainer);
            return current.get(providerDescriptor);
          };
          if (this.container.isBound(uniq)) this.container.unbind(uniq);
          (bind as any)(uniq).toFactory(toFactory);
          if (!this.container.isBound(legacy)) {
            (bind as any)(legacy).toFactory(toFactory);
          }
          if (!this.container.isBound(globalRef)) {
            (bind as any)(globalRef).toFactory(toFactory);
          }

          this.providerClasses.add(providerDescriptor);

          continue;
        }

        const serviceIdentifier = providerDescriptor.provide as ServiceIdentifier;

        if (providerDescriptor.useValue !== undefined) {
          if (this.container.isBound(serviceIdentifier as any)) this.container.unbind(serviceIdentifier as any);
          bind(serviceIdentifier as any).toConstantValue(providerDescriptor.useValue);
          this.providerScopes.set(serviceIdentifier, 'Singleton');
          continue;
        }

        if (providerDescriptor.useFactory) {
          const factory = providerDescriptor.useFactory;
          const injects = providerDescriptor.inject ?? [];
          if (this.container.isBound(serviceIdentifier as any)) this.container.unbind(serviceIdentifier as any);
          (bind as any)(serviceIdentifier as any).toDynamicValue(async (ctx: any) => {
            const deps = await Promise.all(injects.map((id) => (ctx.container as InversifyContainer).getAsync(id as any)));
            return await factory(...deps);
          }).inSingletonScope();
          this.providerScopes.set(serviceIdentifier, 'Singleton');
          continue;
        }

        const implementationClass = providerDescriptor.useClass ?? (providerDescriptor.provide as any);
        if (this.container.isBound(serviceIdentifier as any)) this.container.unbind(serviceIdentifier as any);
        const binding = bind(serviceIdentifier as any).to(implementationClass as any);

        const { uniq, legacy, globalRef } = this.getFactoryTokensForClass(implementationClass as any);
        const toFactory = (ctx: any) => () => {
          const current = RequestContext.getCurrentContainer() ?? (ctx.container as InversifyContainer);
          return current.get(serviceIdentifier as any);
        };
        if (this.container.isBound(uniq)) this.container.unbind(uniq);
        (bind as any)(uniq).toFactory(toFactory);
        if (!this.container.isBound(legacy)) {
          (bind as any)(legacy).toFactory(toFactory);
        }
        if (!this.container.isBound(globalRef)) {
          (bind as any)(globalRef).toFactory(toFactory);
        }

        switch (providerDescriptor.scope) {
          case 'Transient':
            binding.inTransientScope();
            this.providerScopes.set(serviceIdentifier, 'Transient');
            break;
          case 'Request':
            binding.inRequestScope();
            this.providerScopes.set(serviceIdentifier, 'Request');
            break;
          default:
            binding.inSingletonScope();
            this.providerScopes.set(serviceIdentifier, 'Singleton');
        }

        this.providerClasses.add(serviceIdentifier);
      }

      for (const controllerClass of metadata.controllers ?? []) {
        if (this.container.isBound(controllerClass)) this.container.unbind(controllerClass);
        bind(controllerClass).toSelf().inSingletonScope();

        this.controllerClasses.add(controllerClass);
      }
    };

    this.container.load(new ContainerModule(containerModuleFactory as any));
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
  async loadAndGetAllNonRequest() {
    const providerIds = this.getProviderClasses().filter(id => this.providerScopes.get(id) !== 'Request');

    const [providerInstances, controllerInstances] = await Promise.all([
      Promise.all(providerIds.map(r => this.container.getAsync(r as any).catch(() => undefined))),
      Promise.all(this.getControllerClasses().map(r => this.container.getAsync(r).catch(() => undefined))),
    ]);

    return {
      providers: providerInstances.filter(Boolean),
      controllers: controllerInstances.filter(Boolean),
    };
  }

  getProviderEntries() {
    return Array.from(this.providerClasses).map(id => ({ id, scope: this.providerScopes.get(id) as ProviderScope }));
  }

  /**
   * Create a request-scoped child container.
   */
  createRequestContainer() {
    return new InversifyContainer({ parent: this.container, defaultScope: 'Request' });
  }
}