import type { AnyFunction, RootModuleFile } from '@bunner/core';

import type { RouteHandlerParamType } from './decorators';

export interface BunnerHttpServerOptions {
  port?: number;
  bodyLimit?: number;
  trustProxy?: boolean;
}

/**
 * Worker Init Params
 * @description The parameters for initializing a worker
 */
export interface WorkerInitParams {
  rootModuleFile: RootModuleFile;
  options: WorkerOptions;
}

/**
 * Worker Options
 * @description The options for the worker
 */
export interface WorkerOptions {}

/**
 * HTTP Worker Response
 * @description The response structure sent from the worker to the main thread
 */
export interface HttpWorkerResponse {
  body: any;
  init: ResponseInit;
}

/**
 * Route Handler Entry
 * @description The entry for a route handler
 */
export interface RouteHandlerEntry {
  handler: AnyFunction;
  paramType: RouteHandlerParamType[];
  paramRefs: any[]; // Parameter Types (Constructors or Strings)
}

export interface ArgumentMetadata {
  type: 'body' | 'query' | 'param' | 'custom';
  metatype?: any;
  data?: string;
}

export interface PipeTransform<T = any, R = any> {
  transform(value: T, metadata: ArgumentMetadata): R | Promise<R>;
}
