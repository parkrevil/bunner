import { Module, type OnInit, type Configurer, type AdapterCollection } from '@bunner/common';
import { BunnerApplication } from '@bunner/core';
import {
  CorsMiddleware,
  HttpMethod,
  HttpMiddlewareLifecycle,
  QueryParserMiddleware,
  type BunnerHttpAdapter,
} from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';
import { Scalar } from '@bunner/scalar';

import { BillingModule } from './billing/billing.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { PostsModule } from './posts';
import { UsersModule } from './users';

@Module({
  imports: [UsersModule, PostsModule, BillingModule],
  providers: [{ provide: Logger, useFactory: () => new Logger('AppModule') }],
})
export class AppModule implements OnInit, Configurer {
  constructor(private readonly logger: Logger) {
    this.logger.info('AppModule initialized');
  }

  configure(_app: BunnerApplication, adapters: AdapterCollection) {
    Scalar.setup(adapters, {
      documentTargets: 'all',
      httpTargets: ['http-server'],
    });

    const httpAdapter = adapters.http?.get('http-server') as BunnerHttpAdapter;

    if (httpAdapter) {
      httpAdapter
        .addMiddlewares(HttpMiddlewareLifecycle.BeforeRequest, [
          LoggerMiddleware,
          CorsMiddleware.withOptions({
            origin: '*',
            methods: [HttpMethod.Get, HttpMethod.Post, HttpMethod.Put, HttpMethod.Delete, HttpMethod.Options],
          }),
        ])
        .addMiddlewares(HttpMiddlewareLifecycle.AfterRequest, [QueryParserMiddleware]);
    }
  }

  onInit() {
    this.logger.info('✨ AppModule.onInit() triggered!');
  }

  onApplicationInit() {
    // Legacy code removed
  }
}
