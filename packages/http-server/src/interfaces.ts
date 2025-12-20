import type { AnyFunction, RootModuleFile } from '@bunner/core';

import type { RouteHandlerParamType } from './decorators';

export interface BunnerHttpServerOptions {
  port?: number;
  bodyLimit?: number;
  trustProxy?: boolean;
}

export interface WorkerInitParams {
  rootModuleFile: RootModuleFile;
  options: WorkerOptions;
}

export interface WorkerOptions {}

export interface HttpWorkerResponse {
  body: any;
  init: ResponseInit;
}

export interface RouteHandlerEntry {
  handler: AnyFunction;
  paramType: RouteHandlerParamType[];
  paramRefs: any[];
}

export interface ArgumentMetadata {
  type: 'body' | 'query' | 'param' | 'custom';
  metatype?: any;
  data?: string;
}

export interface PipeTransform<T = any, R = any> {
  transform(value: T, metadata: ArgumentMetadata): R | Promise<R>;
}
