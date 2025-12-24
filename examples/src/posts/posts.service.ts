import { Injectable } from '@bunner/common';
import { Logger } from '@bunner/logger';

import { CommentsService } from './comments';
import { PostsRepository } from './posts.repository';

@Injectable()
export class PostsService {
  constructor(
    private readonly postRepo: PostsRepository,
    private readonly commentsService: CommentsService,
    private readonly logger: Logger,
  ) {
    this.logger.debug('PostsService initialized');
  }

  findAll() {
    return this.postRepo.findAll();
  }

  findOneById(id: number) {
    return this.postRepo.findOneById(id);
  }

  create(body: any) {
    return this.postRepo.create(body);
  }

  update(id: number, data: any) {
    return this.postRepo.update(id, data);
  }

  delete(id: number) {
    return this.postRepo.delete(id);
  }

  createComment(id: number, body: any) {
    return this.commentsService.create(id, body);
  }
}
