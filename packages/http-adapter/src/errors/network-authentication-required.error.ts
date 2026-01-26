import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class NetworkAuthenticationRequiredError extends HttpError {
  constructor(message = 'Network Authentication Required') {
    super(StatusCodes.NETWORK_AUTHENTICATION_REQUIRED, message);
  }
}
