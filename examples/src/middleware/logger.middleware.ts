import { Middleware, type Context } from '@bunner/core';
import { Logger } from '@bunner/logger';

@Middleware()
export class LoggerMiddleware implements Middleware {
  private logger = new Logger('LoggerMiddleware');

  handle(ctx: Context) {
    const req = ctx.getAdapter().getRequest();
    this.logger.info(`[${req.method}] ${req.url}`);
  }
}
