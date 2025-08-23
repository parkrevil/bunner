import { Delete, Get, Post, RestController } from '../../../../src';
import { UsersService } from './users.service';

@RestController('users', {
  version: 'v1',
})
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  getList() {
    return this.usersService.getList();
  }

  @Get(':id', {
    version: 'v2',
  })
  getById() {
    return this.usersService.getById(1);
  }

  @Post('')
  create() {
    return this.usersService.create();
  }

  @Delete(':id')
  delete() {
    return this.usersService.delete(1);
  }
}
