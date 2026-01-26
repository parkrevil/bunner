import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found') {
    super(StatusCodes.NOT_FOUND, message);
  }
}
