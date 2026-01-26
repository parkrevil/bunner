import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(StatusCodes.FORBIDDEN, message);
  }
}
