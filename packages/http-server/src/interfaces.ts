import type { BaseModule, Class, Container, LogLevel } from '@bunner/core';

import type { BunnerRequest } from './bunner-request';
import type { BunnerResponse } from './bunner-response';
import type { WorkerTask } from './enums';
import type { HandlerFunction } from './types';

export interface BunnerHttpServerOptions {
  logLevel?: LogLevel;
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

export interface WorkerTaskMessage {
  task: WorkerTask;
  payload?: any;
}

export interface WorkerConstructParams {
  options: BunnerHttpServerOptions;
  containerClass: Class<Container>;
  rootModuleClass: Class<BaseModule>;
}
