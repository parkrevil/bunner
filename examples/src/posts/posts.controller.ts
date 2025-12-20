import { RestController, Delete, Get, Param, Post, Put, Body } from '@bunner/http-server';

import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@RestController('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  getAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.postsService.findOneById(Number(id));
  }

  @Post()
  create(@Body() body: CreatePostDto) {
    return this.postsService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdatePostDto) {
    return this.postsService.update(Number(id), body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.postsService.delete(Number(id));
  }

  @Post(':id/comments')
  createComment(@Param('id') id: string, @Body() body: any) {
    return this.postsService.createComment(Number(id), body);
  }
}
