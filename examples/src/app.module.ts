import { RootModule } from '@bunner/core';
import { Logger } from '@bunner/logger';

import { PostsModule } from './posts';
import { UsersModule } from './users';

import { ScalarModule } from '@bunner/scalar';

@RootModule({
  path: __filename,
  imports: [
    UsersModule,
    PostsModule,
    ScalarModule.forRoot({
      title: 'Bunner Example API',
      version: '1.0.0',
      path: '/api-docs'
    })
  ],
})
export class AppModule {
  constructor(private readonly logger: Logger) {
    this.logger.info('AppModule initialized');
  }
}