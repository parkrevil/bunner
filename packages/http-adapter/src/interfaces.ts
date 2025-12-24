import type { AnyFunction, BunnerApplicationOptions, ErrorHandler } from '@bunner/common';

import type { BunnerRequest } from './bunner-request';
import type { BunnerResponse } from './bunner-response';
import type { RouteHandlerParamType } from './decorators';

export interface BunnerHttpMiddleware {
  handle(req: BunnerRequest, res: BunnerResponse): Promise<void> | void;
}

export interface BunnerHttpServerOptions extends BunnerApplicationOptions {
  port?: number;
  bodyLimit?: number;
  trustProxy?: boolean;
  workers?: number;
  middlewares?: {
    beforeRequest: BunnerHttpMiddleware[];
    afterRequest: BunnerHttpMiddleware[];
    beforeHandler: BunnerHttpMiddleware[];
    beforeResponse: BunnerHttpMiddleware[];
    afterResponse: BunnerHttpMiddleware[];
  };
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
  middlewares: BunnerHttpMiddleware[];
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
