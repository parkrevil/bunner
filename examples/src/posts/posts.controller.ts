import { Controller } from '@bunner/http-server';

@Controller()
export class PostsController {
  constructor() {
    console.log('Posts Controller Constructor');
  }
}