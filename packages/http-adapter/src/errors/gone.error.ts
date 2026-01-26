import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class GoneError extends HttpError {
  constructor(message = 'Gone') {
    super(StatusCodes.GONE, message);
  }
}
