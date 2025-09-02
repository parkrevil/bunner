import { Module } from '@bunner/core';
import { CommentsService } from './comments.service';
import { CommentRepository } from './comments.repository';

@Module({
  controllers: [],
  providers: [CommentsService, CommentRepository],
  exports: [CommentsService],
})
export class CommentsModule {
  constructor() {
    console.log('Comments Module Constructor');
  }
}