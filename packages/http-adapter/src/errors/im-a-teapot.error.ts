import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class ImATeapotError extends HttpError {
  constructor(message = "I'm a teapot") {
    super(StatusCodes.IM_A_TEAPOT, message);
  }
}
