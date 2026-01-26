import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class LengthRequiredError extends HttpError {
  constructor(message = 'Length Required') {
    super(StatusCodes.LENGTH_REQUIRED, message);
  }
}
