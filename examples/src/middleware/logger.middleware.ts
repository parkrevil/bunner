import { Middleware, BunnerMiddleware, type Context } from '@bunner/common';
import { BunnerHttpContext } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

@Middleware()
export class LoggerMiddleware extends BunnerMiddleware {
  private logger = new Logger('LoggerMiddleware');

  handle(ctx: Context) {
    const http = ctx.to(BunnerHttpContext);

    this.logger.info(`[${http.request.method}] ${http.request.url}`);
  }
}
