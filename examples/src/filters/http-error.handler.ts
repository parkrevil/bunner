import { type BunnerValue, type Context, Catch } from '@bunner/common';
import { BunnerHttpContext } from '@bunner/http-adapter';
import { Logger, type LogMetadataValue } from '@bunner/logger';

import type { HttpErrorPayload, HttpErrorResponse } from './interfaces';

@Catch()
export class HttpErrorHandler {
  private logger = new Logger('HttpErrorHandler');

  catch(error: BunnerValue, ctx: Context): HttpErrorResponse {
    const http = ctx.to(BunnerHttpContext);
    const res = http.response;
    const req = http.request;
    const errorPayload = this.getHttpErrorPayload(error);

    this.logger.error('Caught error:', this.toLogMetadataValue(error));

    res.setStatus(500);

    return {
      statusCode: 500,
      message: errorPayload?.message ?? 'Internal Server Error',
      path: req.url,
    };
  }

  private getHttpErrorPayload(error: BunnerValue): HttpErrorPayload | undefined {
    if (error instanceof Error) {
      return { message: error.message };
    }

    if (!this.isBunnerRecord(error)) {
      return undefined;
    }

    const messageValue = error.message;
    const statusValue = error.status;
    const hasMessage = typeof messageValue === 'string' && messageValue.length > 0;
    const hasStatus = typeof statusValue === 'number';

    if (hasMessage || hasStatus) {
      return {
        ...(hasMessage ? { message: messageValue } : {}),
        ...(hasStatus ? { status: statusValue } : {}),
      };
    }

    return undefined;
  }

  private toLogMetadataValue(value: BunnerValue): LogMetadataValue {
    if (value instanceof Error) {
      return value;
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'function') {
      return 'function';
    }

    if (typeof value === 'symbol') {
      return 'symbol';
    }

    if (typeof value === 'object') {
      const serialized = JSON.stringify(value);

      return serialized ?? 'Unserializable error';
    }

    return 'Unknown error';
  }

  private isBunnerRecord(value: BunnerValue): value is Record<string, BunnerValue> {
    return typeof value === 'object' && value !== null;
  }
}
