import {
  RestController,
  Delete,
  Get,
  Params,
  Post,
  Put,
  Body,
} from '@bunner/http-server';

import { UsersService } from './users.service';

@RestController('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  update(@Params() params: any, @Body() body: any) {
    const { id } = params;

    return this.usersService.update(id, body);
  }

  @Delete(':id')
  delete(@Params() params: any) {
    const { id } = params;

    return this.usersService.delete(id);
  }
}
