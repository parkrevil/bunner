import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class BadGatewayError extends HttpError {
  constructor(message = 'Bad Gateway') {
    super(StatusCodes.BAD_GATEWAY, message);
  }
}
