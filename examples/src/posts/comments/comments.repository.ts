import { Injectable } from '@bunner/core';

@Injectable()
export class CommentsRepository {
  private comments: any[] = [
    {
      id: 1,
      postId: 1,
      content: 'Comment 1',
    },
    {
      id: 2,
      postId: 1,
      content: 'Comment 2',
    },
  ];

  constructor() {
    console.log('Comment Repository Constructor');
  }

  findAll() {
    return this.comments;
  }

  findOneById(id: number) {
    return this.comments.find(comment => comment.id === id);
  }

  create(postId: number, body: any) {
    this.comments.push({
      id: this.comments.length + 1,
      postId,
      content: body.content,
    });
  }
}