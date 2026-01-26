import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class UnavailableForLegalReasonsError extends HttpError {
  constructor(message = 'Unavailable For Legal Reasons') {
    super(StatusCodes.UNAVAILABLE_FOR_LEGAL_REASONS, message);
  }
}
