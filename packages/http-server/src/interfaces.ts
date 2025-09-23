import type { RootModuleFile } from '@bunner/core';

import type { BunnerRequest } from './bunner-request';
import type { BunnerResponse } from './bunner-response';
import type { FfiOptions } from './ffi';
import type { HandlerFunction } from './types';

export interface BunnerHttpServerOptions {
  port: number;
  bodyLimit: number;
}

/**
 * Find Handler Result
 * @description The result of finding a handler
 */
export interface FindHandlerResult {
  handler: HandlerFunction;
  request: BunnerRequest;
  response: BunnerResponse;
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
export interface WorkerOptions extends FfiOptions {}
