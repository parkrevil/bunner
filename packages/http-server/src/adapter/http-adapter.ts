import type { Adapter } from '@bunner/core';

import type { BunnerRequest } from '../bunner-request';
import type { BunnerResponse } from '../bunner-response';

export interface HttpAdapter extends Adapter {
  getRequest(): BunnerRequest;
  getResponse(): BunnerResponse;
  setHeader(name: string, value: string): void;
  setStatus(status: number): void;
}
