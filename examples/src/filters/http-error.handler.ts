import { Catch, type Context, type ErrorHandler } from '@bunner/core';
import { Logger } from '@bunner/logger';

@Catch()
export class HttpErrorHandler implements ErrorHandler {
  private logger = new Logger('HttpErrorHandler');

  catch(error: any, ctx: Context) {
    const adapter = ctx.getAdapter();
    const res = adapter.getResponse();

    this.logger.error('Caught error:', error);

    res.setStatus(500);
    return {
      statusCode: 500,
      message: error.message || 'Internal Server Error',
      path: adapter.getRequest().url,
    };
  }
}
