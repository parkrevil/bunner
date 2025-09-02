import { Injectable } from '@bunner/core';
import { UserRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  findAll() {
    return this.userRepository.findAll();
  }

  findOneById(id: number) {
    return this.userRepository.findOneById(id);
  }

  create(body: any) {
    this.userRepository.create(body);
  }

  update(id: number, data: any) {
    this.userRepository.updateById(id, data);
  }

  delete(id: number) {
    this.userRepository.deleteById(id);
  }
}
