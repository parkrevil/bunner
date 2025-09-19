import type { LogLevel } from '@bunner/core';

import type { BunnerRequest } from './bunner-request';
import type { BunnerResponse } from './bunner-response';
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
