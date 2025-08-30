import { HttpMethod, HttpStatusCode } from '../types';

/**
 * Controller Decorator Options
 * @description The options for the controller decorator
 */
export interface ControllerDecoratorOptions {
  version?: string;
  middlewares?: ControllerMiddlewareMetadata;
  document?: ControllerApiDocumentMetadata;
}

/**
 * Controller Api Document Metadata
 * @description The metadata for the controller api document
 */
export interface ControllerApiDocumentMetadata {
  summary?: string;
  description?: string;
  tags?: string[];
}

/**
 * Controller Middleware Metadata
 * @description The metadata for the controller middleware
 */
export interface ControllerMiddlewareMetadata {
  beforeHandler?: number[];
  afterHandler?: number[];
}

/**
 * Http Method Decorator Options
 * @description The options for the http method decorator
 */
export interface HttpMethodDecoratorOptions {
  httpStatus?: HttpStatusCode;
  version?: string;
  middlewares?: RouteHandlerMiddlewareMetadata;
  document?: HttpMethodApiDocumentMetadata;
}

/**
 * Http Method Decorator Metadata
 * @description The metadata for the http method decorator
 */
export interface HttpMethodDecoratorMetadata extends HttpMethodDecoratorOptions {
  path?: string;
  httpMethod: HttpMethod;
}

/**
 * Route Handler Middleware Metadata
 * @description The metadata for the route handler middleware
 */
export interface RouteHandlerMiddlewareMetadata {
  beforeHandler?: number[];
  afterHandler?: number[];
}

/**
 * Http Method Api Document Metadata
 * @description The metadata for the http method api document
 */
export interface HttpMethodApiDocumentMetadata {
  summary?: string;
  description?: string;
}
