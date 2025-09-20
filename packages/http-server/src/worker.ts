import { BaseWorker } from '@bunner/core';

export class Worker extends BaseWorker {
  protected run(task: any) {
    console.log(task);
  }
}

export const worker = new Worker();
