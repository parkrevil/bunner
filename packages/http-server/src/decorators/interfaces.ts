import type { HttpMethod } from '../enums';

import type { RouteHandlerParamType } from './types';

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
  httpMethod: HttpMethod;
  path?: string;
  options?: HttpMethodDecoratorOptions;
}

/**
 * Route Handler Parameter Metadata
 * @description The metadata for the route handler parameters
 */
export interface RestRouteHandlerParamMetadata {
  index: number;
  type: RouteHandlerParamType;
}
