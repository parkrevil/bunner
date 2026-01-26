import { Injectable } from '@bunner/common';

import { CommentRepository } from './comments.repository';
import type { PostCommentInput } from './interfaces';

@Injectable({
  visibility: 'exported',
})
export class CommentsService {
  private readonly commentsRepo = new CommentRepository();

  create(id: number, body: PostCommentInput): void {
    this.commentsRepo.create(id, body);
  }
}
