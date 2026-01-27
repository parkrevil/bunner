import { BunnerContextError, type BunnerValue, type ClassToken } from '@bunner/common';

import type { BunnerRequest } from '../bunner-request';
import type { BunnerResponse } from '../bunner-response';
import type { HttpAdapter } from './http-adapter';
import type { HttpContext } from './interfaces';

import { HTTP_CONTEXT_TYPE } from '../constants';

export class BunnerHttpContext implements HttpContext {
  private adapter: HttpAdapter;

  constructor(adapter: BunnerValue) {
    this.adapter = this.assertHttpAdapter(adapter);
  }

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

  private assertHttpAdapter(value: BunnerValue): HttpAdapter {
    if (this.isHttpAdapter(value)) {
      return value;
    }

    throw new BunnerContextError('Invalid HTTP adapter provided to BunnerHttpContext');
  }

  private isHttpAdapter(value: BunnerValue): value is HttpAdapter {
    return (
      typeof value === 'object' &&
      value !== null &&
      'getRequest' in value &&
      'getResponse' in value &&
      'setHeader' in value &&
      'setStatus' in value
    );
  }
}
