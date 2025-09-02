import { Injectable } from '@bunner/core';
import { CommentRepository } from './comments.repository';

@Injectable()
export class CommentsService {
  constructor(private readonly commentsRepo: CommentRepository) {}

  create(id: number, body: any) {
    return this.commentsRepo.create(id, body);
  }
}