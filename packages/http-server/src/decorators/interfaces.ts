import type { HttpMethodValue } from '../types';

/**
 * Controller Decorator Options
 * @description The options for the controller decorator
 */
export interface RestControllerDecoratorOptions {}

/**
 * Controller Metadata
 * @description The metadata for the http method decorator
 */
export interface RestControllerMetadata {
  target: Function;
  path?: string;
  options?: RestControllerDecoratorOptions;
}

/**
 * Http Method Decorator Options
 * @description The options for the http method decorator
 */
export interface HttpMethodDecoratorOptions {}

/**
 * Http Method Decorator Metadata
 * @description The metadata for the http method decorator
 */
export interface RestRouteHandlerMetadata {
  target: Function;
  propertyKey: string | symbol;
  httpMethod: HttpMethodValue;
  path?: string;
  options?: HttpMethodDecoratorOptions;
}

/**
 * Parameter Metadata
 * @description The metadata for the parameter decorator
 */
export interface RestHttpParamMetadata {
  index: number;
  type: string;
}
