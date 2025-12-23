import { Middleware, type Context } from '@bunner/core';
import { isHttpContext } from '@bunner/http-server';
import { Logger } from '@bunner/logger';

@Middleware()
export class AuditMiddleware implements Middleware {
  private logger = new Logger('AuditMiddleware');

  handle(ctx: Context) {
    if (isHttpContext(ctx)) {
      const req = ctx.request;
      this.logger.info(`[AUDIT] Billing Action Attempted: ${req.method} ${req.url}`);

      // Simulate auditing check
      const headers = req.headers;
      if (!headers.get('x-transaction-id')) {
        this.logger.warn('[AUDIT] Missing Transaction ID');
      }
    }
  }
}
