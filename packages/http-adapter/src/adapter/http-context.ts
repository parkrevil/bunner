import { BunnerContextError, type BunnerValue, type ClassToken } from '@bunner/common';

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

  get(_key: string): BunnerValue | undefined {
    // Basic implementation for now, can be expanded later
    return undefined;
  }

  to(ctor: typeof BunnerHttpContext): BunnerHttpContext;
  to<TContext>(ctor: ClassToken<TContext>): TContext;
  to<TContext>(ctor: ClassToken<TContext> | typeof BunnerHttpContext): TContext | this {
    if (ctor === BunnerHttpContext || ctor?.name === BunnerHttpContext.name) {
      return this;
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
