import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class PreconditionRequiredError extends HttpError {
  constructor(message = 'Precondition Required') {
    super(StatusCodes.PRECONDITION_REQUIRED, message);
  }
}
