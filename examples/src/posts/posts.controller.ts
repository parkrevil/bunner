import { RestController, Delete, Get, Params, Post, Put, Body } from '@bunner/http-server';

import { PostsService } from './posts.service';

@RestController('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  getAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  getById(params: any) {
    const { id } = params;
    return this.postsService.findOneById(id);
  }

  @Post()
  create(body: any) {
    return this.postsService.create(body);
  }

  @Put(':id')
  update(params: any, body: any) {
    const { id } = params;

    return this.postsService.update(id, body);
  }

  @Delete(':id')
  delete(params: any) {
    const { id } = params;

    return this.postsService.delete(id);
  }

  @Post(':id/comments')
  createComment(params: any, body: any) {
    const { id } = params;

    return this.postsService.createComment(id, body);
  }
}
