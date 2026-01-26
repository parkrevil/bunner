import { StatusCodes } from 'http-status-codes';

import { HttpError } from './http-error';

export class UpgradeRequiredError extends HttpError {
  constructor(message = 'Upgrade Required') {
    super(StatusCodes.UPGRADE_REQUIRED, message);
  }
}
