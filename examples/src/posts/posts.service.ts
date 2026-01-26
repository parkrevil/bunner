import { Injectable } from '@bunner/common';
import { Logger } from '@bunner/logger';

import { CommentsService } from './comments';
import { PostsRepository } from './posts.repository';
import type { Post } from './interfaces';
import type { PostCommentInput } from './comments/interfaces';

@Injectable()
export class PostsService {
  constructor(
    private readonly postRepo: PostsRepository,
    private readonly commentsService: CommentsService,
    private readonly logger: Logger,
  ) {
    this.logger.debug('PostsService initialized');
  }

  findAll(): ReadonlyArray<Post> {
    return this.postRepo.findAll();
  }

  findOneById(id: number): Post | undefined {
    return this.postRepo.findOneById(id);
  }

  create(body: Post): number {
    return this.postRepo.create(body);
  }

  update(id: number, data: Post): Post {
    return this.postRepo.update(id, data);
  }

  delete(id: number): Post[] {
    return this.postRepo.delete(id);
  }

  createComment(id: number, body: PostCommentInput): void {
    this.commentsService.create(id, body);
  }
}
