import type { HttpMethodValue } from '../types';

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
  options?: ControllerDecoratorOptions;
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
  propertyKey: string | symbol;
  httpMethod: HttpMethodValue;
  path?: string;
  options?: HttpMethodDecoratorOptions;
}

/**
 * Parameter Metadata
 * @description The metadata for the parameter decorator
 */
export interface HttpParamMetadata {
  index: number;
  type: string;
}
