export function Catch(..._exceptions: any[]): ClassDecorator {
  return () => {};
}

export function UseErrorFilters(..._filters: any[]): MethodDecorator & ClassDecorator {
  return () => {};
}
