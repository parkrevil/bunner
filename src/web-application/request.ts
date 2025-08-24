import type { SocketAddress } from 'bun';
import type { BunnerRequestConstructorParams } from '../interfaces';

export class BunnerRequest {
  readonly raw: Request;
  readonly params: Record<string, any>;
  readonly queryParams: Record<string, any>;
  readonly body: any;
  readonly query: Record<string, string>;
  readonly ip: string | undefined;
  readonly socketAddress: SocketAddress | undefined;

  constructor(params: BunnerRequestConstructorParams) {
    this.raw = params.request;
    this.params = params.params;
    this.query = params.queryParams;
    this.body = this.raw.body;
    this.socketAddress = params.server.requestIP(this.raw) || undefined;

    const xff = this.raw.headers.get('x-forwarded-for');
    this.ip = xff ? xff?.split(',')[0]?.trim() : this.raw.headers.get('x-real-ip') || this.socketAddress?.address || undefined;
  }

  /**
   * Get the URL of the request
   * @returns The URL of the request
   */
  get url() {
    return this.raw.url;
  }

  /**
   * Get the method of the request
   * @returns The method of the request
   */
  get method() {
    return this.raw.method;
  }

  /**
   * Get the family of the request
   * @returns The family of the request
   */
  get family() {
    return this.socketAddress?.family;
  }
}
