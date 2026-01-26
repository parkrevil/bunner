import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class PaymentRequiredError extends HttpError {
  constructor(message = 'Payment Required') {
    super(StatusCodes.PAYMENT_REQUIRED, message);
  }
}
