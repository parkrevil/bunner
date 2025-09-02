import { EmitDecoratorMetadataError } from '@bunner/core';
import { MetadataKey } from './constants';
import type { RestHttpParamMetadata } from './interfaces';

function createHttpParamDecorator(type: string) {
  return function(target: Object, propertyKey: string | symbol | undefined, index: number) {
    if (!propertyKey) {
      throw new EmitDecoratorMetadataError();
    }

    const existingParams: RestHttpParamMetadata[] = Reflect.getMetadata(MetadataKey.RouteHandlerParam, target, propertyKey) ?? [];
    existingParams.push({ index, type });

    Reflect.defineMetadata(MetadataKey.RouteHandlerParam, existingParams, target, propertyKey);
  };
}

/**
 * Body HTTP parameter decorator
 * @description Inject the body object
 * @returns 
 */
export const Body = () => createHttpParamDecorator('body');

/**
 * Query HTTP parameter decorator
 * @description Inject the query object
 * @returns 
 */
export const Query = () => createHttpParamDecorator('query');

/**
 * Params HTTP parameter decorator
 * @description Inject the params object
 * @returns 
 */
export const Params = () => createHttpParamDecorator('param');

/**
 * Request HTTP parameter decorator
 * @description Inject the BunnerRequest object
 * @returns 
 */
export const Request = () => createHttpParamDecorator('request');

/**
 * Response HTTP parameter decorator
 * @description Inject the BunnerResponse object
 * @returns 
 */
export const Response = () => createHttpParamDecorator('response');
