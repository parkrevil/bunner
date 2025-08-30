import { Controller } from '@bunner/http-server';

@Controller()
export class CommentsController {
  constructor() {
    console.log('Comments Controller Constructor');
  }
}