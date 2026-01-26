import type { BunnerModule } from '@bunner/core';

import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';

export const module: BunnerModule = {
  name: 'PostsModule',
  providers: [PostsService, PostsRepository],
};
