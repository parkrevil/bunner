import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class ProxyAuthenticationRequiredError extends HttpError {
  constructor(message = 'Proxy Authentication Required') {
    super(StatusCodes.PROXY_AUTHENTICATION_REQUIRED, message);
  }
}
