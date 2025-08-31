import { Injectable } from '@bunner/core';

@Injectable()
export class UserRepository {
  private users: any[] = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Doe' },
    { id: 3, name: 'John Smith' },
    { id: 4, name: 'Jane Smith' },
    { id: 5, name: 'John Doe' },
    { id: 6, name: 'Jane Doe' },
    { id: 7, name: 'John Smith' },
    { id: 8, name: 'Jane Smith' },
    { id: 9, name: 'John Doe' },
    { id: 10, name: 'Jane Doe' },
    { id: 11, name: 'John Smith' },
    { id: 12, name: 'Jane Smith' },
    { id: 13, name: 'John Doe' },
    { id: 14, name: 'Jane Doe' },
    { id: 15, name: 'John Smith' },
    { id: 16, name: 'Jane Smith' },
  ];

  constructor() {
    console.log('User Repository Constructor');
  }

  findAll() {
    return this.users;
  }

  findOneById(id: number) {
    return this.users.find(user => user.id === id);
  }

  create(data: any) {
    this.users.push(data);
  }

  updateById(id: number, data: any) {
    this.users[this.users.findIndex(user => user.id === id)] = data;
  }

  deleteById(id: number) {
    this.users.splice(this.users.findIndex(user => user.id === id), 1);
  }
}