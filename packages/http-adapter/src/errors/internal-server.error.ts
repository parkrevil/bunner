import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error') {
    super(StatusCodes.INTERNAL_SERVER_ERROR, message);
  }
}
