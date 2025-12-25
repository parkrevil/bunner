import { Middleware, Inject } from '@bunner/common';

import type { BunnerRequest } from '../../bunner-request';
import type { BunnerResponse } from '../../bunner-response';
import type { BunnerHttpMiddleware } from '../../interfaces';

import { QUERY_PARSER_OPTIONS } from './constants';
import type { QueryParserOptions } from './interfaces';
import { QueryParser } from './query-parser';

@Middleware()
export class QueryParserMiddleware implements BunnerHttpMiddleware {
  private readonly parser: QueryParser;

  constructor(@Inject(QUERY_PARSER_OPTIONS) options: QueryParserOptions = {}) {
    this.parser = new QueryParser(options);
  }

  public handle(req: BunnerRequest, _res: BunnerResponse): void {
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
