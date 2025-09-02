import { RestController, Delete, Get, Params, Post, Put, Body } from '@bunner/http-server';
import type { UsersService } from './users.service';

@RestController('users', {
  version: '2',
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {
    console.log('Users Controller Constructor');
  }

  @Get()
  getAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  getById(@Params() params: any) {
    const { id } = params;
    
    return this.usersService.findOneById(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.usersService.create(body);
  }

  @Put(':id')
  update(@Params() params: any) {
    const { id } = params;
    
    return this.usersService.updateById(id);
  }

  @Delete(':id')
  delete(@Params() params: any) {
    const { id } = params;
    
    return this.usersService.deleteById(id);
  }
}