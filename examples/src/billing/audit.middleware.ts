import { Middleware, type Context } from '@bunner/core';
import { Logger } from '@bunner/logger';

@Middleware()
export class AuditMiddleware implements Middleware {
  private logger = new Logger('AuditMiddleware');

  handle(ctx: Context) {
    const req = ctx.getAdapter().getRequest();
    this.logger.info(`[AUDIT] Billing Action Attempted: ${req.method} ${req.url}`);

    // Simulate auditing check
    const headers = req.headers;
    if (!headers['x-transaction-id']) {
      this.logger.warn('[AUDIT] Missing Transaction ID');
    }
  }
}
