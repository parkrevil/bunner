import type { HttpMethodValue } from '../types';

/**
 * Controller Decorator Options
 * @description The options for the controller decorator
 */
export interface RestControllerDecoratorOptions {
  version?: string;
}

/**
 * Controller Metadata
 * @description The metadata for the http method decorator
 */
export interface RestControllerMetadata {
  path?: string;
  options?: RestControllerDecoratorOptions;
}

/**
 * Http Method Decorator Options
 * @description The options for the http method decorator
 */
export interface HttpMethodDecoratorOptions {
  version?: string;
}

/**
 * Http Method Decorator Metadata
 * @description The metadata for the http method decorator
 */
export interface RestRouteHandlerMetadata {
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
