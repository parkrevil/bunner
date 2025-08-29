import { ContainerModule, Container as InversifyContainer } from 'inversify';
import type { ClassType } from '../../../types';
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
   * Unbind token if already bound.
   */
  private unbindIfBound(token: any) {
    if (this.container.isBound(token)) {
      this.container.unbind(token);
    }
  }

  /**
   * Bind factory tokens so consumers can inject factory functions for a service.
   * Factory resolves using current ALS request container when available.
   */
  private bindFactoryTokensForClass(targetClass: Function, serviceToResolve: ServiceIdentifier, bind: any) {
    const { uniq, legacy, globalRef } = this.getFactoryTokensForClass(targetClass);

    const toFactory = (ctx: any) => () => {
      const currentContainer = RequestContext.getCurrentContainer() ?? (ctx.container as InversifyContainer);
      return currentContainer.get(serviceToResolve as any);
    };

    this.unbindIfBound(uniq);
    (bind as any)(uniq).toFactory(toFactory);

    if (!this.container.isBound(legacy)) {
      (bind as any)(legacy).toFactory(toFactory);
    }

    if (!this.container.isBound(globalRef)) {
      (bind as any)(globalRef).toFactory(toFactory);
    }
  }

  /**
   * Bind class provider as Singleton and expose factory tokens.
   */
  private bindClassProvider(providerClass: Function, bind: any) {
    this.unbindIfBound(providerClass);

    bind(providerClass).toSelf().inSingletonScope();

    this.providerScopes.set(providerClass as unknown as ServiceIdentifier, 'Singleton');
    this.providerClasses.add(providerClass as unknown as ServiceIdentifier);

    this.bindFactoryTokensForClass(providerClass, providerClass as any, bind);
  }

  /**
   * Bind descriptor provider (useValue/useFactory/useClass) with scope and factory tokens.
   */
  private bindDescriptorProvider(descriptor: Exclude<ProviderDescriptor, Function>, bind: any) {
    const serviceIdentifier = descriptor.provide as ServiceIdentifier;

    if (descriptor.useValue !== undefined) {
      this.unbindIfBound(serviceIdentifier);
      bind(serviceIdentifier as any).toConstantValue(descriptor.useValue);
      this.providerScopes.set(serviceIdentifier, 'Singleton');
      this.providerClasses.add(serviceIdentifier);
      return;
    }

    if (descriptor.useFactory) {
      const factory = descriptor.useFactory;
      const injects = descriptor.inject ?? [];

      this.unbindIfBound(serviceIdentifier);
      (bind as any)(serviceIdentifier as any)
        .toDynamicValue(async (ctx: any) => {
          const deps = await Promise.all(injects.map((id) => (ctx.container as InversifyContainer).getAsync(id as any)));
          return await factory(...deps);
        })
        .inSingletonScope();

      this.providerScopes.set(serviceIdentifier, 'Singleton');
      this.providerClasses.add(serviceIdentifier);
      return;
    }

    const implementationClass = (descriptor.useClass ?? descriptor.provide) as Function;

    this.unbindIfBound(serviceIdentifier);
    const bindingFluent = bind(serviceIdentifier as any).to(implementationClass as any);

    switch (descriptor.scope) {
      case 'Transient':
        bindingFluent.inTransientScope();
        this.providerScopes.set(serviceIdentifier, 'Transient');
        break;
      case 'Request':
        bindingFluent.inRequestScope();
        this.providerScopes.set(serviceIdentifier, 'Request');
        break;
      default:
        bindingFluent.inSingletonScope();
        this.providerScopes.set(serviceIdentifier, 'Singleton');
    }

    this.providerClasses.add(serviceIdentifier);
    this.bindFactoryTokensForClass(implementationClass, serviceIdentifier, bind);
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
        const descriptor = providerEntry as ProviderDescriptor;

        if (typeof descriptor === 'function') {
          this.bindClassProvider(descriptor, bind);
          continue;
        }

        this.bindDescriptorProvider(descriptor as any, bind);
      }

      for (const controllerClass of metadata.controllers ?? []) {
        this.unbindIfBound(controllerClass);
        bind(controllerClass).toSelf().inSingletonScope();
        this.controllerClasses.add(controllerClass);
      }
    };

    this.container.load(new ContainerModule(containerModuleFactory as any));
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
    const providerIds = Array.from(this.providerClasses).filter(id => this.providerScopes.get(id) !== 'Request');
    const [providerInstances, controllerInstances] = await Promise.all([
      Promise.all(providerIds.map(r => this.container.getAsync(r as any).catch(() => undefined))),
      Promise.all(this.getControllerClasses().map(r => this.container.getAsync(r).catch(() => undefined))),
    ]);

    return {
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