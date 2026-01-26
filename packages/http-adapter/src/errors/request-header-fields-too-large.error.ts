import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class RequestHeaderFieldsTooLargeError extends HttpError {
  constructor(message = 'Request Header Fields Too Large') {
    super(StatusCodes.REQUEST_HEADER_FIELDS_TOO_LARGE, message);
  }
}
