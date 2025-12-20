import type { HttpMethod } from '../enums';

import type { RouteHandlerParamType } from './types';

export interface RestControllerDecoratorOptions {
  version?: string;
}

export interface RestControllerMetadata {
  path?: string;
  options?: RestControllerDecoratorOptions;
}

export interface HttpMethodDecoratorOptions {
  version?: string;
}

export interface RestRouteHandlerMetadata {
  httpMethod: HttpMethod;
  path?: string;
  options?: HttpMethodDecoratorOptions;
}

export interface RestRouteHandlerParamMetadata {
  index: number;
  type: RouteHandlerParamType;
}