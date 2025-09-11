import { EmitDecoratorMetadataError } from '../errors';
import { isClass } from '../helpers';
import {
  MetadataKey,
  ReflectMetadataKey,
  type InjectMetadata,
  type ForwardRef,
  isForwardRef,
  type ProviderToken,
} from '../injector';

/**
 * Inject Decorator
 * @description Injects a provider into a parameter
 * @param providerToken
 * @returns
 */
export function Inject(
  providerToken?: ProviderToken | ForwardRef,
): ParameterDecorator {
  return function (
    target: object,
    property: string | symbol | undefined,
    index: number,
  ) {
    let token: InjectMetadata['token'];
    let provider: InjectMetadata['provider'];

    if (providerToken) {
      if (isForwardRef(providerToken)) {
        token = providerToken;
        provider = undefined;
      } else if (isClass(providerToken)) {
        token = providerToken;
        provider = providerToken;
      } else {
        token = providerToken;
        provider = undefined;
      }
    } else {
      const paramtypes = Reflect.getMetadata(
        ReflectMetadataKey.DesignParamTypes,
        target,
        property!,
      );

      if (!paramtypes || !paramtypes[index]) {
        throw new EmitDecoratorMetadataError();
      }

      token = paramtypes[index];
      provider = paramtypes[index];
    }

    const existingParams: InjectMetadata[] =
      Reflect.getMetadata(MetadataKey.Inject, target, property!) ?? [];
    existingParams.push({ index, token, provider });

    Reflect.defineMetadata(
      MetadataKey.Inject,
      existingParams,
      target,
      property!,
    );
  };
}
