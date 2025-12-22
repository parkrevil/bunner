import type { AnyFunction, BunnerApplicationBaseOptions, Middleware, ErrorHandler } from '@bunner/core';

import type { BunnerRequest } from './bunner-request';
import type { BunnerResponse } from './bunner-response';
import type { RouteHandlerParamType } from './decorators';

export interface BunnerHttpServerOptions extends BunnerApplicationBaseOptions {
  port?: number;
  bodyLimit?: number;
  trustProxy?: boolean;
}

export interface WorkerInitParams {
  rootModuleClassName: string;
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
  controllerClass: any;
  methodName: string;
  middlewares: Middleware[];
  errorHandlers: ErrorHandler[];
  paramFactory: (req: BunnerRequest, res: BunnerResponse) => Promise<any[]>;
}

export interface ArgumentMetadata {
  type: 'body' | 'query' | 'param' | 'custom';
  metatype?: any;
  data?: string;
}

export interface PipeTransform<T = any, R = any> {
  transform(value: T, metadata: ArgumentMetadata): R | Promise<R>;
}
