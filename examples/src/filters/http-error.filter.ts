import { BunnerErrorFilter, type Context, Catch } from '@bunner/common';
import { BunnerHttpContext } from '@bunner/http-adapter';
import { Logger, type LogMetadataValue } from '@bunner/logger';

import type { HttpErrorPayload } from './interfaces';

@Catch()
export class HttpErrorFilter extends BunnerErrorFilter {
  private logger = new Logger('HttpErrorFilter');

  public catch(error: unknown, ctx: Context): void {
    const http = ctx.to(BunnerHttpContext);
    const res = http.response;
    const req = http.request;
    const errorPayload = this.getHttpErrorPayload(error);
    const status = this.resolveStatus(errorPayload?.status);

    this.logger.error('Caught error:', error as LogMetadataValue);

    res.setStatus(status);
    res.setBody({
      statusCode: status,
      message: errorPayload?.message ?? 'Internal Server Error',
      path: req.url,
    });
  }

  private getHttpErrorPayload(error: unknown): HttpErrorPayload | undefined {
    if (error instanceof Error) {
      return { message: error.message };
    }

    if (typeof error !== 'object' || error === null) {
      return undefined;
    }

    const candidate = error as HttpErrorPayload;

    if (candidate.message || candidate.status) {
      return candidate;
    }

    return undefined;
  }

  private resolveStatus(status: HttpErrorPayload['status']): number {
    if (typeof status === 'number' && status !== 101 && status >= 200 && status <= 599) {
      return status;
    }

    return 500;
  }
}
