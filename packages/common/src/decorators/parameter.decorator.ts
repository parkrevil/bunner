import type { ProviderToken } from '../interfaces';
import type { DecoratorTarget } from '../types';

export function Inject(_token: ProviderToken) {
  return (_target: DecoratorTarget, _propertyKey: string | symbol | undefined, _parameterIndex?: number) => {};
}

export function Optional() {
  return (_target: DecoratorTarget, _propertyKey: string | symbol | undefined, _parameterIndex?: number) => {};
}
