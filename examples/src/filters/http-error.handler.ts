import { type Context, Catch } from '@bunner/common';
import { BunnerHttpContext } from '@bunner/http-adapter';
import { Logger, type LogMetadataValue } from '@bunner/logger';
import type { HttpErrorPayload } from './interfaces';

@Catch()
export class HttpErrorHandler {
  private logger = new Logger('HttpErrorHandler');

  catch(error: unknown, ctx: Context): HttpErrorPayload & { statusCode: number; path: string } {
    const http = ctx.to(BunnerHttpContext);
    const res = http.response;
    const req = http.request;
    const errorPayload = this.getHttpErrorPayload(error);

    this.logger.error('Caught error:', error as LogMetadataValue);

    res.setStatus(500);

    return {
      statusCode: 500,
      message: errorPayload?.message ?? 'Internal Server Error',
      path: req.url,
    };
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
}
