import { Injectable } from '@bunner/common';

import { CommentRepository } from './comments.repository';

@Injectable({
  visibility: 'exported',
})
export class CommentsService {
  constructor(private readonly commentsRepo: CommentRepository) {}

  create(id: number, body: any) {
    this.commentsRepo.create(id, body);
  }
}
