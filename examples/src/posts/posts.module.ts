import { Module } from '@bunner/core';
import { CommentsModule } from './comments';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [CommentsModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}