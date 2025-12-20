import { isClass } from '../common/helpers';

import type { ForwardRef, ProviderUseClass, ProviderUseExisting, ProviderUseFactory, ProviderUseValue } from '.';

export function isForwardRef(value: any): value is ForwardRef {
  return value && typeof value.forwardRef === 'function';
}

export function isUseValueProvider(value: any): value is ProviderUseValue {
  return value && value.useValue !== undefined;
}

export function isUseClassProvider(value: any): value is ProviderUseClass {
  return value && isClass(value.useClass);
}

export function isUseExistingProvider(value: any): value is ProviderUseExisting {
  return value && isClass(value.useExisting);
}

export function isUseFactoryProvider(value: any): value is ProviderUseFactory {
  return value && typeof value.useFactory === 'function';
}