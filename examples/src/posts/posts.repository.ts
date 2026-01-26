import { Injectable } from '@bunner/common';

import type { Post } from './interfaces';

@Injectable()
export class PostsRepository {
  private posts: Post[] = [
    {
      id: 1,
      title: 'Post 1',
      content: 'Content 1',
    },
    {
      id: 2,
      title: 'Post 2',
      content: 'Content 2',
    },
  ];

  findAll(): ReadonlyArray<Post> {
    return this.posts;
  }

  findOneById(id: number): Post | undefined {
    return this.posts.find(post => post.id === id);
  }

  create(body: Post): number {
    return this.posts.push(body);
  }

  update(id: number, data: Post): Post {
    return (this.posts[this.posts.findIndex(post => post.id === id)] = data);
  }

  delete(id: number): Post[] {
    return this.posts.splice(
      this.posts.findIndex(post => post.id === id),
      1,
    );
  }
}
