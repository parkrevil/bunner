import type { StatusCodes } from 'http-status-codes';
import type { HttpMethodApiDocument, RestControllerApiDocument } from '../interfaces';
import type { HttpMethodValue } from '../types';
import type { MiddlewareGroup } from '../providers/middleware/types';

export interface RestControllerDecoratorOptions {
  version?: string;
  document?: RestControllerApiDocument;
  middlewares?: ControllerMiddlewareMeta;
}

export interface RestControllerDecoratorMetadata extends RestControllerDecoratorOptions {
  path?: string;
}

export interface HttpMethodDecoratorOptions {
  httpStatus?: StatusCodes;
  version?: string;
  document?: HttpMethodApiDocument;
  middlewares?: HandlerMiddlewareMeta;
}

export interface HttpMethodDecoratorMetadata extends HttpMethodDecoratorOptions {
  path?: string;
  httpMethod: HttpMethodValue;
}

export interface ControllerMiddlewareMeta {
  beforeHandler?: MiddlewareGroup[];
  afterHandler?: MiddlewareGroup[];
}

export interface HandlerMiddlewareMeta {
  beforeHandler?: MiddlewareGroup[];
  afterHandler?: MiddlewareGroup[];
}
