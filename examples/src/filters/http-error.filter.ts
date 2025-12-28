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
    const errorStatus = (error as any)?.status;
    const status =
      typeof errorStatus === 'number' && errorStatus !== 101 && errorStatus >= 200 && errorStatus <= 599 ? errorStatus : 500;

    this.logger.error('Caught error:', error);

    res.setStatus(status as any);
    res.setBody({
      statusCode: status,
      message: (error as any)?.message || 'Internal Server Error',
      path: req.url,
    });
  }
}
