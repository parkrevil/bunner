import { type Context, Catch } from '@bunner/common';
import { BunnerHttpContext } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

@Catch()
export class HttpErrorHandler {
  private logger = new Logger('HttpErrorHandler');

  catch(error: any, ctx: Context) {
    const http = ctx.to(BunnerHttpContext);
    const res = http.response;
    const req = http.request;

    this.logger.error('Caught error:', error);

    res.setStatus(500);

    return {
      statusCode: 500,
      message: error.message ?? 'Internal Server Error',
      path: req.url,
    };
  }
}
