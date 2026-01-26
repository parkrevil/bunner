import { Injectable } from '@bunner/common';
import { Logger } from '@bunner/logger';

import type { User } from './interfaces';

import { UserRepository } from './users.repository';

@Injectable({
  visibility: 'exported',
})
export class UsersService {
  private readonly userRepository = new UserRepository();
  private readonly logger = new Logger('UsersService');

  findAll(): ReadonlyArray<User> {
    return this.userRepository.findAll();
  }

  findOneById(id: number): User | undefined {
    return this.userRepository.findOneById(id);
  }

  create(body: User): void {
    this.logger.info('Creating user', body);

    this.userRepository.create(body);
  }

  update(id: number, data: User): void {
    this.userRepository.updateById(id, data);
  }

  delete(id: number): void {
    this.userRepository.deleteById(id);
  }
}
