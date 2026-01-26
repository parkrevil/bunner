import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class ServiceUnavailableError extends HttpError {
  constructor(message = 'Service Unavailable') {
    super(StatusCodes.SERVICE_UNAVAILABLE, message);
  }
}
