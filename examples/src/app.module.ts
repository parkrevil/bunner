import { Module } from '@bunner/core';
import { CorsMiddleware, HTTP_BEFORE_REQUEST, HTTP_ERROR_HANDLER, HttpMethod } from '@bunner/http-server';
import { Logger } from '@bunner/logger';
import { ScalarModule } from '@bunner/scalar';

import { BillingModule } from './billing/billing.module';
import { HttpErrorHandler } from './filters/http-error.handler';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { PostsModule } from './posts';
import { UsersModule } from './users';

@Module({
  imports: [
    UsersModule,
    PostsModule,
    BillingModule,
    ScalarModule.forRoot({
      title: 'Bunner Example API',
      version: '1.0.0',
      path: '/api-docs',
    }),
  ],
  providers: [
    { provide: HTTP_BEFORE_REQUEST, useClass: [LoggerMiddleware] },
    {
      provide: HTTP_BEFORE_REQUEST,
      useFactory: () => [
        new CorsMiddleware({
          origin: '*',
          methods: [HttpMethod.Get, HttpMethod.Post, HttpMethod.Put, HttpMethod.Delete, HttpMethod.Options],
        }),
      ],
    },
    { provide: HTTP_ERROR_HANDLER, useClass: [HttpErrorHandler] },
  ],
})
export class AppModule {
  constructor(private readonly logger: Logger) {
    this.logger.info('AppModule initialized');
  }
}
