import { BunnerErrorFilter, type Context, Catch } from '@bunner/common';
import { BunnerHttpContext } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';

@Catch()
export class HttpErrorFilter extends BunnerErrorFilter {
  private logger = new Logger('HttpErrorFilter');

  public catch(error: unknown, ctx: Context): void {
    const http = ctx.to(BunnerHttpContext);
    const res = http.response;
    const req = http.request;

    this.logger.error('Caught error:', error);

    res.setStatus(500);
    res.setBody({
      statusCode: 500,
      message: (error as any)?.message || 'Internal Server Error',
      path: req.url,
    });
  }
}
