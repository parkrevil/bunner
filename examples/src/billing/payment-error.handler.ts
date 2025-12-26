import { type Context, Catch } from '@bunner/common';
import { BunnerHttpContext } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

import { PaymentFailedError } from './payment-failed.error';

@Catch(PaymentFailedError)
export class PaymentErrorHandler {
  private logger = new Logger('PaymentErrorHandler');

  catch(error: PaymentFailedError, ctx: Context) {
    this.logger.error(`[BILLING ERROR] ${error.message}`);

    const http = ctx.to(BunnerHttpContext);
    const res = http.response;

    res.setStatus(402); // Payment Required

    return {
      success: false,
      error: 'PAYMENT_REQUIRED',
      details: error.reason,
      amount: error.amount,
    };
  }
}
