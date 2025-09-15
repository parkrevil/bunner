import { MetadataKey } from './enums';
import type { FfiFunctionMetadata, FfiPointerValueType } from './types';

/**
 * FFI Callback Decorator
 */
export function FfiCallback(): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const metadata: FfiFunctionMetadata = Reflect.getOwnMetadata(
      MetadataKey.FfiCallback,
      target,
      propertyKey,
    );

    if (metadata) {
      return;
    }

    Reflect.defineMetadata(
      MetadataKey.FfiCallback,
      new Map<number, FfiPointerValueType>(),
      target,
      propertyKey,
    );
  };
}

/**
 * FFI Releasable Parameter Decorator
 */
export function FfiReleasable(type: FfiPointerValueType): ParameterDecorator {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    index: number,
  ) {
    if (!propertyKey) {
      return;
    }

    const metadata: FfiFunctionMetadata =
      Reflect.getOwnMetadata(MetadataKey.FfiCallback, target, propertyKey) ??
      new Map<number, FfiPointerValueType>();

    metadata.set(index, type);

    Reflect.defineMetadata(
      MetadataKey.FfiCallback,
      metadata,
      target,
      propertyKey,
    );
  };
}
