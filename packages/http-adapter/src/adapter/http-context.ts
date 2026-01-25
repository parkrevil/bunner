import { BunnerContextError } from '@bunner/common';

import type { BunnerRequest } from '../bunner-request';
import type { BunnerResponse } from '../bunner-response';
import type { HttpAdapter } from './http-adapter';
import type { HttpContext } from './interfaces';

import { HTTP_CONTEXT_TYPE } from '../constants';

export class BunnerHttpContext implements HttpContext {
  constructor(private adapter: HttpAdapter) {}

  getType(): string {
    return HTTP_CONTEXT_TYPE;
  }

  get<T = any>(_key: string): T | undefined {
    // Basic implementation for now, can be expanded later
    return undefined;
  }

  to<TContext>(ctor: new (...args: any[]) => TContext): TContext {
    if (ctor === BunnerHttpContext || ctor?.name === BunnerHttpContext.name) {
      return this as unknown as TContext;
    }

    throw new BunnerContextError(`Context cast failed: ${ctor.name || 'UnknownContext'}`);
  }

  get request(): BunnerRequest {
    return this.adapter.getRequest();
  }

  get response(): BunnerResponse {
    return this.adapter.getResponse();
  }
}
