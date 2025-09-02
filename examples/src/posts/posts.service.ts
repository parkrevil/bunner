import { Injectable } from '@bunner/core';
import { CommentsService } from './comments';
import { PostsRepository } from './posts.repository';

@Injectable()
export class PostsService {
  constructor(
    private readonly postRepo: PostsRepository,
    private readonly commentsService: CommentsService,
  ) {}

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