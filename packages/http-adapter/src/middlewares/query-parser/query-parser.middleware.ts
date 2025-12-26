import { Middleware, BunnerMiddleware, type Context } from '@bunner/common';

import { BunnerHttpContext } from '../../adapter';

import type { QueryParserOptions } from './interfaces';
import { QueryParser } from './query-parser';

@Middleware()
export class QueryParserMiddleware extends BunnerMiddleware<QueryParserOptions> {
  private readonly parser: QueryParser;

  constructor(options: QueryParserOptions = {}) {
    super();

    this.parser = new QueryParser(options);
  }

  public handle(context: Context): void {
    const http = context.to(BunnerHttpContext);
    const req = http.request;
    const questionIndex = req.url.indexOf('?');

    if (questionIndex === -1) {
      req.query = {};

      return;
    }

    const queryString = req.url.slice(questionIndex + 1);

    if (queryString.length === 0) {
      req.query = {};

      return;
    }

    req.query = this.parser.parse(queryString);
  }
}
