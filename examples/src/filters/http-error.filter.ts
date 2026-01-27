import { BunnerErrorFilter, type BunnerValue, type Context, Catch } from '@bunner/common';
import { BunnerHttpContext } from '@bunner/http-adapter';
import { Logger, type LogMetadataValue } from '@bunner/logger';

import type { HttpErrorPayload } from './interfaces';

@Catch()
export class HttpErrorFilter extends BunnerErrorFilter {
  private logger = new Logger('HttpErrorFilter');

  public catch(error: BunnerValue, ctx: Context): void {
    const http = ctx.to(BunnerHttpContext);
    const res = http.response;
    const req = http.request;
    const errorPayload = this.getHttpErrorPayload(error);
    const status = this.resolveStatus(errorPayload?.status);

    this.logger.error('Caught error:', this.toLogMetadataValue(error));

    res.setStatus(status);
    res.setBody({
      statusCode: status,
      message: errorPayload?.message ?? 'Internal Server Error',
      path: req.url,
    });
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

  private resolveStatus(status: HttpErrorPayload['status']): number {
    if (typeof status === 'number' && status !== 101 && status >= 200 && status <= 599) {
      return status;
    }

    return 500;
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
