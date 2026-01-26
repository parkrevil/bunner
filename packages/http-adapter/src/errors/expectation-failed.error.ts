import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class ExpectationFailedError extends HttpError {
  constructor(message = 'Expectation Failed') {
    super(StatusCodes.EXPECTATION_FAILED, message);
  }
}
