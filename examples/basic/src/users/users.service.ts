import { Injectable } from '../../../../src';

@Injectable()
export class UsersService {
  private users = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
    },

    {
      id: 2,
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    },
    {
      id: 3,
      name: 'John Smith',
      email: 'john.smith@example.com',
    },
  ];

  getList() {
    return this.users;
  }

  getById(id: number) {
    return this.users.find((user) => user.id === id);
  }

  create() {
    return this.users.push({
      id: 4,
      name: 'John Doe',
      email: 'john.doe@example.com',
    });
  }

  delete(id: number) {
    return this.users.splice(this.users.findIndex((user) => user.id === id), 1);
  }
}
