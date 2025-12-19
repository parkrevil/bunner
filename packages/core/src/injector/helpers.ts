import { isClass } from '../common/helpers';

import type { ForwardRef, ProviderUseClass, ProviderUseExisting, ProviderUseFactory, ProviderUseValue } from '.';

/**
 * Is Forward Ref
 * @description Checks if a value is a forward ref
 * @param value
 * @returns
 */
export function isForwardRef(value: any): value is ForwardRef {
  return value && typeof value.forwardRef === 'function';
}

/**
 * Is Use Value Provider
 * @description Checks if a value is a use value provider
 * @param value
 * @returns
 */
export function isUseValueProvider(value: any): value is ProviderUseValue {
  return value && value.useValue !== undefined;
}

/**
 * Is Use Class Provider
 * @description Checks if a value is a use class provider
 * @param value
 * @returns
 */
export function isUseClassProvider(value: any): value is ProviderUseClass {
  return value && isClass(value.useClass);
}

/**
 * Is Use Existing Provider
 * @description Checks if a value is a use existing provider
 * @param value
 * @returns
 */
export function isUseExistingProvider(value: any): value is ProviderUseExisting {
  return value && isClass(value.useExisting);
}

/**
 * Is Use Factory Provider
 * @description Checks if a value is a factory provider
 * @param value
 * @returns
 */
export function isUseFactoryProvider(value: any): value is ProviderUseFactory {
  return value && typeof value.useFactory === 'function';
}
