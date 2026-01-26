import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class RequestTimeoutError extends HttpError {
  constructor(message = 'Request Timeout') {
    super(StatusCodes.REQUEST_TIMEOUT, message);
  }
}
