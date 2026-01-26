import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class MethodNotAllowedError extends HttpError {
  constructor(message = 'Method Not Allowed') {
    super(StatusCodes.METHOD_NOT_ALLOWED, message);
  }
}
