import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class NotImplementedError extends HttpError {
  constructor(message = 'Not Implemented') {
    super(StatusCodes.NOT_IMPLEMENTED, message);
  }
}
