import { Module } from '@bunner/core';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {
  constructor() {
    console.log('Comments Module Constructor');
  }
}