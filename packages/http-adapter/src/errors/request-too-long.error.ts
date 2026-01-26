import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class RequestTooLongError extends HttpError {
  constructor(message = 'Request Too Long') {
    super(StatusCodes.REQUEST_TOO_LONG, message);
  }
}
