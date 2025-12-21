import { Catch, type Context, type ErrorHandler } from '@bunner/core';
import { Logger } from '@bunner/logger';

import { PaymentFailedError } from './payment-failed.error';

@Catch(PaymentFailedError)
export class PaymentErrorHandler implements ErrorHandler<PaymentFailedError> {
  private logger = new Logger('PaymentErrorHandler');

  catch(error: PaymentFailedError, ctx: Context) {
    this.logger.error(`[BILLING ERROR] ${error.message}`);
    const res = ctx.getAdapter().getResponse();

    res.setStatus(402); // Payment Required
    return {
      success: false,
      error: 'PAYMENT_REQUIRED',
      details: error.reason,
      amount: error.amount,
    };
  }
}
