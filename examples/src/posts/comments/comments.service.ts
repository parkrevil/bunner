import { Injectable } from '@bunner/common';

import { CommentRepository } from './comments.repository';
import type { PostCommentInput } from './interfaces';

@Injectable({
  visibility: 'exported',
})
export class CommentsService {
  constructor(private readonly commentsRepo: CommentRepository) {}

  create(id: number, body: PostCommentInput): void {
    this.commentsRepo.create(id, body);
  }
}
