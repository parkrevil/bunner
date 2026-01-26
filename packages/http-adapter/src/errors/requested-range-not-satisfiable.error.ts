import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class RequestedRangeNotSatisfiableError extends HttpError {
  constructor(message = 'Range Not Satisfiable') {
    super(StatusCodes.REQUESTED_RANGE_NOT_SATISFIABLE, message);
  }
}
