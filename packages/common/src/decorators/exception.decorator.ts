export function Catch(..._exceptions: any[]): ClassDecorator {
  return () => {};
}

export function UseErrorHandlers(..._handlers: any[]): MethodDecorator & ClassDecorator {
  return () => {};
}
