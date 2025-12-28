import type { BunnerModule } from '@bunner/common';
import { CorsMiddleware, HttpMethod, HttpMiddlewareLifecycle, QueryParserMiddleware } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';
import { provideScalar } from '@bunner/scalar';

import { HttpErrorFilter } from './filters/http-error.filter';
import { LoggerMiddleware } from './middleware/logger.middleware';

export const rootModule: BunnerModule = {
  name: 'AppModule',
  providers: [
    HttpErrorFilter,
    { provide: Logger, useFactory: () => new Logger('AppModule') },
    ...provideScalar({
      documentTargets: 'all',
      httpTargets: 'all',
    }),
  ],
  adapters: {
    http: {
      '*': {
        middlewares: {
          [HttpMiddlewareLifecycle.BeforeRequest]: [
            LoggerMiddleware,
            CorsMiddleware.withOptions({
              origin: '*',
              methods: [HttpMethod.Get, HttpMethod.Post, HttpMethod.Put, HttpMethod.Delete, HttpMethod.Options],
            }),
          ],
          [HttpMiddlewareLifecycle.AfterRequest]: [QueryParserMiddleware],
        },
        errorFilters: [HttpErrorFilter],
      },
      'user-api-server': {},
      'admin-api-server': {},
    },
  },
};
