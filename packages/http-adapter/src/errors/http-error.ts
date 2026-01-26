import { StatusCodes } from 'http-status-codes';

export class HttpError extends Error {
  public readonly statusCode: StatusCodes;

  constructor(statusCode: StatusCodes, message: string) {
    super(message);

    this.statusCode = statusCode;
  }
}
