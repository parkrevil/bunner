import { Middleware } from '@bunner/common';
import type { BunnerHttpMiddleware, BunnerRequest, BunnerResponse } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

@Middleware()
export class AuditMiddleware implements BunnerHttpMiddleware {
  private logger = new Logger('AuditMiddleware');

  handle(req: BunnerRequest, _res: BunnerResponse) {
    this.logger.info(`[AUDIT] Billing Action Attempted: ${req.method} ${req.url}`);

    // Simulate auditing check
    const headers = req.headers;
    if (!headers.get('x-transaction-id')) {
      this.logger.warn('[AUDIT] Missing Transaction ID');
    }
  }
}
