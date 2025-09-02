import { EmitDecoratorMetadataError } from '../errors';
import { MetadataKey, ReflectMetadataKey, type InjectMetadata, type ForwardRef, isForwardRef, type ProviderToken } from '../injector';

/**
 * Inject Decorator
 * @description Injects a provider into a parameter
 * @param providerToken 
 * @returns 
 */
export function Inject(providerToken?: ProviderToken | ForwardRef): ParameterDecorator {
  return function(target: Object, property: string | symbol | undefined, index: number) {
    let token: InjectMetadata['token'];
    let type: InjectMetadata['type'];
    const existingParams: InjectMetadata[] = Reflect.getMetadata(MetadataKey.Inject, target, property!) ?? [];

    if (providerToken && isForwardRef(providerToken)) {
      token = providerToken.forwardRef;
      type = undefined;
    } else if (providerToken) {
      token = providerToken;
      type = typeof token === 'function' ? token : undefined;
    } else {
      const paramtypes = Reflect.getMetadata(ReflectMetadataKey.DesignParamtypes, target, property!);

      if (!paramtypes || !paramtypes[index]) {
        throw new EmitDecoratorMetadataError();
      }
      token = paramtypes[index];
      type = paramtypes[index];
    }

    existingParams.push({ index, type, token });
    
    Reflect.defineMetadata(MetadataKey.Inject, existingParams, target, property!);
  };
}
