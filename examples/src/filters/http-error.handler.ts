import { type Context, Catch } from '@bunner/common';
import { isHttpContext } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

@Catch()
export class HttpErrorHandler {
  private logger = new Logger('HttpErrorHandler');

  catch(error: any, ctx: Context) {
    if (isHttpContext(ctx)) {
      const res = ctx.response;
      const req = ctx.request;

      this.logger.error('Caught error:', error);

      res.setStatus(500);
      return {
        statusCode: 500,
        message: error.message || 'Internal Server Error',
        path: req.url,
      };
    }
  }
}
