import type { BunnerModule } from '@bunner/core';

import { CommentRepository } from './comments.repository';
import { CommentsService } from './comments.service';

export const module: BunnerModule = {
  name: 'CommentsModule',
  providers: [CommentsService, CommentRepository],
};
