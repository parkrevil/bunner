import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class GatewayTimeoutError extends HttpError {
  constructor(message = 'Gateway Timeout') {
    super(StatusCodes.GATEWAY_TIMEOUT, message);
  }
}
