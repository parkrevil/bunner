import { EmitDecoratorMetadataError } from '../errors';
import { isClass } from '../helpers';
import {
  METADATA_KEY,
  REFLECT_METADATA_KEY,
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
        REFLECT_METADATA_KEY.DESIGN_PARAM_TYPES,
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
      Reflect.getMetadata(METADATA_KEY.INJECT, target, property!) ?? [];
    existingParams.push({ index, token, provider });

    Reflect.defineMetadata(
      METADATA_KEY.INJECT,
      existingParams,
      target,
      property!,
    );
  };
}
