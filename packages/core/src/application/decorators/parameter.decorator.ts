// AOT Markers - Zero Overhead
// Note: Standard Decorators do not support Parameters yet.
// These are kept as NO-OPs or used as Field Decorators if property injection is desired.

export function Inject(_token: any) {
  // Return standard field decorator signature
  return (_value: undefined, context: ClassFieldDecoratorContext) => {
    if (context.kind !== 'field') {
      return;
    }
    // No runtime logic needed if CLI handles injection map
  };
}

export function Optional() {
  return (_value: undefined, context: ClassFieldDecoratorContext) => {
    if (context.kind !== 'field') {
      return;
    }
  };
}
