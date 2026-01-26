import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class UnsupportedMediaTypeError extends HttpError {
  constructor(message = 'Unsupported Media Type') {
    super(StatusCodes.UNSUPPORTED_MEDIA_TYPE, message);
  }
}
