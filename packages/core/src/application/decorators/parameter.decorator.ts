// AOT Markers - Zero Overhead
// Note: Standard Decorators do not support Parameters yet.
// These are kept as NO-OPs or used as Field Decorators if property injection is desired.

export function Inject(_token: any) {
  return (_target: object, _propertyKey: string | symbol | undefined, _parameterIndex?: number) => {
    // Works as Property Decorator (index undefined) or Parameter Decorator (index defined)
  };
}

export function Optional() {
  return (_target: object, _propertyKey: string | symbol | undefined, _parameterIndex?: number) => {
    // Works as Property Decorator or Parameter Decorator
  };
}
