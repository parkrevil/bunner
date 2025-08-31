import { Module } from '@bunner/core';
import { CommentsService } from './comments.service';

@Module({
  controllers: [],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {
  constructor() {
    console.log('Comments Module Constructor');
  }
}