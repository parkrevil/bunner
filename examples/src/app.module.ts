import { Module, type OnInit, type Configurer, type AdapterCollection } from '@bunner/common';
import { BunnerApplication } from '@bunner/core';
import { CorsMiddleware, HttpMethod, type BunnerHttpAdapter } from '@bunner/http-adapter';
import { Logger } from '@bunner/logger';
import { ScalarModule } from '@bunner/scalar';

import { BillingModule } from './billing/billing.module';
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
  providers: [Logger],
})
export class AppModule implements OnInit, Configurer {
  constructor(
    private readonly logger: Logger,
  ) {
    this.logger.info('AppModule initialized');
  }

  configure(_app: BunnerApplication, adapters: AdapterCollection) {
    const httpAdapter = adapters.http?.get('http-server') as BunnerHttpAdapter;
    
    if (httpAdapter) {
        httpAdapter.use(
            new LoggerMiddleware(),
            new CorsMiddleware({
              origin: '*',
              methods: [HttpMethod.Get, HttpMethod.Post, HttpMethod.Put, HttpMethod.Delete, HttpMethod.Options],
            }),
        );
    }
  }

  onInit() {
    this.logger.info('✨ AppModule.onInit() triggered!');
  }

  onApplicationInit() {
    // Legacy code removed
  }
}
