import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class MisdirectedRequestError extends HttpError {
  constructor(message = 'Misdirected Request') {
    super(StatusCodes.MISDIRECTED_REQUEST, message);
  }
}
