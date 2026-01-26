import { Injectable } from '@bunner/common';
import { Logger } from '@bunner/logger';

import { CommentsService } from './comments';
import { PostsRepository } from './posts.repository';
import type { CreatePostDto } from './dto/create-post.dto';
import type { UpdatePostDto } from './dto/update-post.dto';
import type { Post } from './interfaces';
import type { PostCommentInput } from './comments/interfaces';

@Injectable()
export class PostsService {
  private readonly postRepo = new PostsRepository();
  private readonly commentsService = new CommentsService();
  private readonly logger = new Logger('PostsService');

  findAll(): ReadonlyArray<Post> {
    return this.postRepo.findAll();
  }

  findOneById(id: number): Post | undefined {
    return this.postRepo.findOneById(id);
  }

  create(body: CreatePostDto): number {
    return this.postRepo.create(body);
  }

  update(id: number, data: UpdatePostDto): Post {
    return this.postRepo.update(id, data);
  }

  delete(id: number): Post[] {
    return this.postRepo.delete(id);
  }

  createComment(id: number, body: PostCommentInput): void {
    this.commentsService.create(id, body);
  }
}
