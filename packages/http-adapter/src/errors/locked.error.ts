import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class LockedError extends HttpError {
  constructor(message = 'Locked') {
    super(StatusCodes.LOCKED, message);
  }
}
