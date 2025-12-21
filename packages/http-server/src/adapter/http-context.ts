import type { Context } from '@bunner/core';

import type { HttpAdapter } from './http-adapter';

export class HttpContext implements Context<HttpAdapter> {
  constructor(private adapter: HttpAdapter) {}

  getAdapter(): HttpAdapter {
    return this.adapter;
  }
}
