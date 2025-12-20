import { RestController, Get, Params, Post, Body, Put, Delete } from '@bunner/http-server';
import { CreateUserComplexDto, AddressDto, SocialDto } from './dto/complex.dto';
import { Logger } from '@bunner/logger';

import { UsersService } from './users.service';

@RestController('users')
export class UsersController {
  private readonly logger = new Logger(UsersController);
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getAll() {
    return this.usersService.findAll();
  }

  @Post('complex')
  complexCreate(body: CreateUserComplexDto) {
    this.logger.info('Complex Data Received:', body);
    return {
      message: 'Validated and Transformed!',
      data: body,
      isNameString: typeof body.name === 'string',
      isAgeNumber: typeof body.age === 'number',
      isAddressInstance: body.addresses?.[0] instanceof AddressDto,
      isSocialInstance: body.social instanceof SocialDto
    };
  }

  @Get(':id')
  getById(params: any) {
    const { id } = params;

    return this.usersService.findOneById(id);
  }

  @Post()
  create(body: any) {
    return this.usersService.create(body);
  }

  @Put(':id')
  update(params: any, body: any) {
    const { id } = params;

    return this.usersService.update(id, body);
  }

  @Delete(':id')
  delete(params: any) {
    const { id } = params;

    return this.usersService.delete(id);
  }
}
