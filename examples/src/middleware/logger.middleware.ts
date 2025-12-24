import { Middleware } from '@bunner/common';
import type { BunnerHttpMiddleware, BunnerRequest, BunnerResponse } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

@Middleware()
export class LoggerMiddleware implements BunnerHttpMiddleware {
  private logger = new Logger('LoggerMiddleware');

  handle(req: BunnerRequest, _res: BunnerResponse) {
    this.logger.info(`[${req.method}] ${req.url}`);
  }
}
