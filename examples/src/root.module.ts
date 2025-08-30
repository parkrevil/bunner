import { Module, type BunnerRootModule } from '@bunner/core';
import { PostsModule } from './posts';
import { UsersModule } from './users';

@Module({
  imports: [UsersModule, PostsModule],
})
export class RootModule implements BunnerRootModule {
  constructor() {
    console.log('Root Module Constructor');
  }

  configure() {
    console.log('Configure');
  }

  registerMiddlewares() {
    console.log('Register Middlewares');
  }
}
