import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class NotAcceptableError extends HttpError {
  constructor(message = 'Not Acceptable') {
    super(StatusCodes.NOT_ACCEPTABLE, message);
  }
}
