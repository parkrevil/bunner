import type { Context } from '@bunner/common';

import { HTTP_CONTEXT_TYPE } from '../constants';

import type { HttpContext } from './interfaces';

export function isHttpContext(ctx: Context): ctx is HttpContext {
  return ctx.getType() === HTTP_CONTEXT_TYPE;
}
