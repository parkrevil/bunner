import { RootModule } from '@bunner/core';

import { PostsModule } from './posts';
import { UsersModule } from './users';

@RootModule({
  path: __filename,
  imports: [UsersModule, PostsModule],
})
export class AppModule {
  constructor() {
    console.log('AppModule initialized');
  }
}
