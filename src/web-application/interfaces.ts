import type { ServeOptions } from 'bun';
import type { StatusCodes } from 'http-status-codes';
import type { MiddlewareFn } from '../types';
import type { HttpMethodType } from './types';

export interface RestControllerApiDocument {
  tags?: string[];
}

export interface HttpMethodApiDocument {
  summary?: string;
  description?: string;
}

export interface RestControllerDecoratorOptions {
  version?: string;
  document?: RestControllerApiDocument;
  middlewares?: MiddlewareFn;
}

export interface RestControllerDecoratorMetadata extends RestControllerDecoratorOptions {
  path?: string;
}

export interface HttpMethodDecoratorOptions {
  httpStatus?: StatusCodes;
  version?: string;
  document?: HttpMethodApiDocument;
  middlewares?: MiddlewareFn;
}

export interface HttpMethodDecoratorMetadata extends HttpMethodDecoratorOptions {
  path?: string;
  httpMethod: HttpMethodType;
}

export interface BunnerWebServerStartOptions extends Omit<ServeOptions, 'fetch'> { }
