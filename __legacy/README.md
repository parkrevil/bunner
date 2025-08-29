# Bunner

## Injector (Inversify)

- Providers
  - Default scope: Singleton. Supports Transient, Request.
  - Factory tokens: Every class provider additionally exposes two factory tokens:
    - Unique: `Symbol("Factory:ref:<ClassName>")` (per-class reference, no collision)
    - Legacy: `Symbol.for("Factory:<ClassName>")` (for backward compatibility)
- Controllers
  - Bound as Singleton by default. Request-scoped dependencies should be injected into services, not controllers.
  - Request scope: Bunner wraps each request in an AsyncLocalStorage context with a per-request child container. Use factories or service methods that resolve dependencies at call time to pick up request scope.
- Exports policy
  - Only tokens listed in `exports` are intended for consumption by other modules. Non-exported providers are considered internal. (Current behavior does not enforce visibility; treat this as a guideline until enforcement is added.)
- Dynamic Modules
  - `forRoot(config)`: returns providers via `useValue` / `useClass`.
  - `forRootAsync(factory)`: returns providers via async `useFactory`.
  - `forFeature(config)`: feature-scoped providers.
  - `forFeatureAsync(factory)`: async feature providers with `inject` support.
- Async loading
  - Prefer `toDynamicValue(async ctx => ...)` for async factories; resolve deps via `await ctx.container.getAsync(token)`.
  - If the module registration phase itself must await external IO before defining bindings, consider using async wrappers around imports (e.g., `imports: [() => import(...)]`).

### Example

```ts
// forRoot
ConfigModuleFactory.forRoot({ name: 'app', version: '1.0.0' });

// forRootAsync
ConfigModuleFactory.forRootAsync(async () => ({ name: 'app-async', version: '1.0.1' }));

// forFeature
FeatureModuleFactory.forFeature();

// forFeatureAsync
FeatureModuleFactory.forFeatureAsync();
```
