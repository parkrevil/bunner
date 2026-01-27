import { Middleware, BunnerMiddleware, type Context } from '@bunner/common';
import { BunnerHttpContext } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

@Middleware()
export class AuditMiddleware extends BunnerMiddleware {
  private logger = new Logger('AuditMiddleware');

  handle(ctx: Context) {
    const http = ctx.to(BunnerHttpContext);

    this.logger.info(`[AUDIT] Billing Action Attempted: ${http.request.method} ${http.request.url}`);

    // Simulate auditing check
    const headers = http.request.headers;
    const transactionId = headers.get('x-transaction-id');

    if (transactionId === null || transactionId.trim().length === 0) {
      this.logger.warn('[AUDIT] Missing Transaction ID');
    }
  }
}
