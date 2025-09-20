import { WorkerEvent } from './enums';
import type { WorkerMessage } from './types';

declare let self: Worker;

export abstract class BaseWorker {
  constructor() {
    self.onmessage = event => this.handleMessage(event.data);
  }

  protected abstract run(task: any): any;

  private handleMessage(data: WorkerMessage<any>) {
    switch (data.event) {
      case WorkerEvent.Task:
        this.run(data.payload);

        break;

      default:
        console.error('Unknown event', data);
    }
  }
}
