import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too Many Requests') {
    super(StatusCodes.TOO_MANY_REQUESTS, message);
  }
}
