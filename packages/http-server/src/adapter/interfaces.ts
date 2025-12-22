import type { Context } from '@bunner/core';

import type { BunnerRequest } from '../bunner-request';
import type { BunnerResponse } from '../bunner-response';

export interface HttpContext extends Context {
  readonly request: BunnerRequest;
  readonly response: BunnerResponse;
}
