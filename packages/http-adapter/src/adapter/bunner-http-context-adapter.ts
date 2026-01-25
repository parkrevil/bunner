import type { BunnerRequest } from '../bunner-request';
import type { BunnerResponse } from '../bunner-response';
import type { HttpAdapter } from './http-adapter';

export class BunnerHttpContextAdapter implements HttpAdapter {
  constructor(
    private req: BunnerRequest,
    private res: BunnerResponse,
  ) {}

  getRequest(): BunnerRequest {
    return this.req;
  }

  getResponse(): BunnerResponse {
    return this.res;
  }

  setHeader(name: string, value: string): void {
    this.res.setHeader(name, value);
  }

  setStatus(status: number): void {
    this.res.setStatus(status);
  }
}
