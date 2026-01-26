import type { ErrorFilterToken } from '../interfaces';
import type { ErrorToken } from '../types';

export function Catch(..._exceptions: Array<ErrorToken>): ClassDecorator {
  return () => {};
}

export function UseErrorFilters(..._filters: Array<ErrorFilterToken>): MethodDecorator & ClassDecorator {
  return () => {};
}
