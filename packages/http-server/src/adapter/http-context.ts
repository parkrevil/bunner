import type { BunnerRequest } from '../bunner-request';
import type { BunnerResponse } from '../bunner-response';
import { HTTP_CONTEXT_TYPE } from '../constants';

import type { HttpAdapter } from './http-adapter';
import type { HttpContext } from './interfaces';

export class BunnerHttpContext implements HttpContext {
  constructor(private adapter: HttpAdapter) {}

  getType(): string {
    return HTTP_CONTEXT_TYPE;
  }

  get<T = any>(_key: string): T | undefined {
    // Basic implementation for now, can be expanded later
    return undefined;
  }

  get request(): BunnerRequest {
    return this.adapter.getRequest();
  }

  get response(): BunnerResponse {
    return this.adapter.getResponse();
  }
}
