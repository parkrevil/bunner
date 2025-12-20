import { RootModule } from '@bunner/core';
import { Logger } from '@bunner/logger';

import { PostsModule } from './posts';
import { UsersModule } from './users';

@RootModule({
  path: __filename,
  imports: [UsersModule, PostsModule],
})
export class AppModule {
  constructor(private readonly logger: Logger) {
    this.logger.info('AppModule initialized');
  }
}
