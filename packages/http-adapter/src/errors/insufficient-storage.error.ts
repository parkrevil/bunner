import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class InsufficientStorageError extends HttpError {
  constructor(message = 'Insufficient Storage') {
    super(StatusCodes.INSUFFICIENT_STORAGE, message);
  }
}
