import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class PreconditionFailedError extends HttpError {
  constructor(message = 'Precondition Failed') {
    super(StatusCodes.PRECONDITION_FAILED, message);
  }
}
