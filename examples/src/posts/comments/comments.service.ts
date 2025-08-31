import { Injectable } from '@bunner/core';
import type { CommentRepository } from './comments.repository';

@Injectable()
export class CommentsService {
  constructor(private readonly commentsRepo: CommentRepository) {
    console.log('Comments Service Constructor');
  }

  create(id: number, body: any) {
    return this.commentsRepo.create(id, body);
  }
}