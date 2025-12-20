import { Module } from '@bunner/core';

import { CommentRepository } from './comments.repository';
import { CommentsService } from './comments.service';

@Module({
  controllers: [],
  providers: [CommentsService, CommentRepository],
  exports: [CommentsService],
})
export class CommentsModule {}
