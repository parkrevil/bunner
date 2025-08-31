import type { HttpMethod } from '../types';

/**
 * Controller Decorator Options
 * @description The options for the controller decorator
 */
export interface ControllerDecoratorOptions {}

/**
 * Controller Metadata
 * @description The metadata for the http method decorator
 */
export interface ControllerMetadata {
  target: Function;
  path?: string;
  routes: RouteHandlerMetadata[];
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
export interface RouteHandlerMetadata {
  target: Function;
  propertyKey: string;
  path?: string;
  httpMethod: HttpMethod;
}

/**
 * Parameter Metadata
 * @description The metadata for the parameter decorator
 */
export interface ParameterMetadata {
  index: number;
  type: string;
  token?: string;
}
