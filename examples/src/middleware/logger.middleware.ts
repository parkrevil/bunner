import { Middleware, type Context } from '@bunner/core';
import { isHttpContext } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

@Middleware()
export class LoggerMiddleware implements Middleware {
  private logger = new Logger('LoggerMiddleware');

  handle(ctx: Context) {
    if (isHttpContext(ctx)) {
      const req = ctx.request;
      this.logger.info(`[${req.method}] ${req.url}`);
    }
  }
}
