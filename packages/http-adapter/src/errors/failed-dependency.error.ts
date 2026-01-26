import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class FailedDependencyError extends HttpError {
  constructor(message = 'Failed Dependency') {
    super(StatusCodes.FAILED_DEPENDENCY, message);
  }
}
