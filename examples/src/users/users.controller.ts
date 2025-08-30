import { Controller } from '@bunner/http-server';

@Controller()
export class UsersController {
  constructor() {
    console.log('Users Controller Constructor');
  }
}