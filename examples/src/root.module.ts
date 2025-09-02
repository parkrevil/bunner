import { Module, type BunnerRootModule } from '@bunner/core';
import { PostsModule } from './posts';
import { UsersModule } from './users';

@Module({
  imports: [UsersModule, PostsModule],
})
export class RootModule implements BunnerRootModule {
  constructor() {}

  configure() {}

  registerMiddlewares() {}
}
