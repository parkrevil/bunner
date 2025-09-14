import { Module, type BaseModule } from '@bunner/core';

import { PostsModule } from './posts';
import { UsersModule } from './users';

@Module({
  imports: [UsersModule, PostsModule],
})
export class RootModule implements BaseModule {
  constructor() {}

  configure() {}

  registerMiddlewares() {}
}
