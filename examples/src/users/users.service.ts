import { Injectable } from '@bunner/common';
import { Logger } from '@bunner/logger';

import { UserRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: Logger,
  ) {
    this.logger.debug('UsersService initialized');
  }

  findAll() {
    return this.userRepository.findAll();
  }

  findOneById(id: number) {
    return this.userRepository.findOneById(id);
  }

  create(body: any) {
    this.logger.info('Creating user', body);
    this.userRepository.create(body);
  }

  update(id: number, data: any) {
    this.userRepository.updateById(id, data);
  }

  delete(id: number) {
    this.userRepository.deleteById(id);
  }
}
