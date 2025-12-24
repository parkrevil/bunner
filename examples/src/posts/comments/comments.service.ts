import { Injectable } from '@bunner/common';

import { CommentRepository } from './comments.repository';

@Injectable()
export class CommentsService {
  constructor(private readonly commentsRepo: CommentRepository) {}

  create(id: number, body: any) {
    return this.commentsRepo.create(id, body);
  }
}
