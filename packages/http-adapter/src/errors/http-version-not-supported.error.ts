import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class HTTPVersionNotSupportedError extends HttpError {
  constructor(message = 'HTTP Version Not Supported') {
    super(StatusCodes.HTTP_VERSION_NOT_SUPPORTED, message);
  }
}
