import type { ServeOptions, Server } from 'bun';
import type { StatusCodes } from 'http-status-codes';
import type { BunnerCreateApplicationOptions } from '../interfaces';
import type { HttpMethodType, MiddlewareFn } from './types';

export interface BunnerCreateWebApplicationOptions extends BunnerCreateApplicationOptions { }

export interface BunnerRequestConstructorParams {
  request: Request;
  server: Server;
  params: Record<string, any>;
  queryParams: Record<string, any>;
}

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

export interface BunnerWebServerStartOptions extends Omit<ServeOptions, 'fetch' | 'error'> { }
