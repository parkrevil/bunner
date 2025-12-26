import { BunnerErrorFilter, type Context, Catch } from '@bunner/common';
import { BunnerHttpContext } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

import { PaymentFailedError } from './payment-failed.error';

@Catch(PaymentFailedError)
export class PaymentErrorFilter extends BunnerErrorFilter<PaymentFailedError> {
  private logger = new Logger('PaymentErrorFilter');

  public catch(error: PaymentFailedError, ctx: Context): void {
    this.logger.error(`[BILLING ERROR] ${error.message}`);

    const http = ctx.to(BunnerHttpContext);
    const res = http.response;

    res.setStatus(402);
    res.setBody({
      success: false,
      error: 'PAYMENT_REQUIRED',
      details: error.reason,
      amount: error.amount,
    });
  }
}
