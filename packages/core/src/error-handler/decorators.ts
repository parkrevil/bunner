export function Catch(..._errors: any[]): ClassDecorator {
  return () => {};
}

export function UseErrorHandlers(..._handlers: any[]): MethodDecorator & ClassDecorator {
  return () => {};
}
