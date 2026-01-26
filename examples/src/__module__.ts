import type { BunnerModule } from '@bunner/core';

import { HttpMiddlewareLifecycle } from '@bunner/http-adapter';
import { provideScalar } from '@bunner/scalar';

import { HttpErrorFilter } from './filters/http-error.filter';
import { LoggerMiddleware } from './middleware/logger.middleware';

export const rootModule: BunnerModule = {
  name: 'AppModule',
  providers: [
    HttpErrorFilter,
    ...provideScalar({
      documentTargets: 'all',
      httpTargets: 'all',
    }),
  ],
  adapters: {
    http: {
      '*': {
        middlewares: {
          [HttpMiddlewareLifecycle.BeforeRequest]: [LoggerMiddleware],
        },
        errorFilters: [HttpErrorFilter],
      },
      'user-api-server': {},
      'admin-api-server': {},
    },
  },
};
