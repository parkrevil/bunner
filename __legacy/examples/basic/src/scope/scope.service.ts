import { Injectable } from '../../../../src';

let transientCounter = 0;

@Injectable()
export class RequestScopedService {
  readonly id: string;
  constructor() {
    this.id = 'req-' + crypto.randomUUID().slice(0, 8);
  }
}

@Injectable()
export class TransientService {
  readonly id: string;
  constructor() {
    this.id = 'tr-' + (++transientCounter) + '-' + crypto.randomUUID().slice(0, 4);
  }
}


