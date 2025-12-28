import type { BunnerModule } from '@bunner/common';

import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';

export const module: BunnerModule = {
  name: 'PostsModule',
  providers: [PostsService, PostsRepository],
};
