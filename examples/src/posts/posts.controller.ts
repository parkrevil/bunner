import { RestController, Delete, Get, Param, Post, Put, Body } from '@bunner/http-adapter';

import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';
import type { Post } from './interfaces';
import type { PostCommentInput } from './comments/interfaces';

@RestController('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  getAll(): ReadonlyArray<Post> {
    return this.postsService.findAll();
  }

  @Get(':id')
  getById(@Param('id') id: string): Post | undefined {
    return this.postsService.findOneById(Number(id));
  }

  @Post()
  create(@Body() body: CreatePostDto): number {
    return this.postsService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdatePostDto): Post {
    return this.postsService.update(Number(id), body);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Post[] {
    return this.postsService.delete(Number(id));
  }

  @Post(':id/comments')
  createComment(@Param('id') id: string, @Body() body: PostCommentInput): void {
    this.postsService.createComment(Number(id), body);
  }
}
