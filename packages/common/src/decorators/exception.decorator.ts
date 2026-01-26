import type { ErrorFilterToken } from '../interfaces';

export function Catch(..._exceptions: Array<ErrorFilterToken>): ClassDecorator {
  return () => {};
}

export function UseErrorFilters(..._filters: Array<ErrorFilterToken>): MethodDecorator & ClassDecorator {
  return () => {};
}
