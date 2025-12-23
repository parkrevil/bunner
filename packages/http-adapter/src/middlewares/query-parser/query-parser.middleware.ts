import { type Context, Middleware } from '@bunner/core';
import { Inject } from '@bunner/core';

import { isHttpContext } from '../../adapter';

import { QUERY_PARSER_OPTIONS } from './constants';
import type { QueryParserOptions } from './interfaces';
import { QueryParser } from './query-parser';

@Middleware()
export class QueryParserMiddleware implements Middleware {
  private readonly parser: QueryParser;

  constructor(@Inject(QUERY_PARSER_OPTIONS) options: QueryParserOptions = {}) {
    this.parser = new QueryParser(options);
  }

  public handle(ctx: Context): boolean | void {
    if (!isHttpContext(ctx)) {
      return;
    }

    const { request } = ctx;
    const questionIndex = request.url.indexOf('?');

    if (questionIndex === -1) {
      request.query = {};

      return;
    }

    const queryString = request.url.slice(questionIndex + 1);

    if (queryString.length === 0) {
      request.query = {};

      return;
    }

    request.query = this.parser.parse(queryString);
  }
}
