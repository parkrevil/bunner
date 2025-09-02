import { Injectable } from '@bunner/core';

@Injectable()
export class PostsRepository {
  private posts: any[] = [
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

  findAll() {
    return this.posts;
  }

  findOneById(id: number) {
    return this.posts.find(post => post.id === id);
  }

  create(body: any) {
    return this.posts.push(body);
  }

  update(id: number, data: any) {
    return this.posts[this.posts.findIndex(post => post.id === id)] = data;
  }

  delete(id: number) {
    return this.posts.splice(this.posts.findIndex(post => post.id === id), 1);
  }
}