import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(StatusCodes.CONFLICT, message);
  }
}
