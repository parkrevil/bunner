import type { SocketAddress } from 'bun';
import { HeaderField } from './constants';
import type { BunnerRequestConstructorParams } from './interfaces';

export class BunnerRequest {
  readonly raw: Request;
  readonly params: Record<string, any>;
  readonly queryParams: Record<string, any>;
  readonly query: Record<string, string>;
  readonly contentType: string | undefined;
  readonly contentLength: number | undefined;
  readonly ip: string | undefined;
  readonly socketAddress: SocketAddress | undefined;
  private _body: any;

  constructor(params: BunnerRequestConstructorParams) {
    this.raw = params.request;
    this.params = params.params;
    this.query = params.queryParams;

    const contentTypeHeader = this.raw.headers.get(HeaderField.ContentType);
    this.contentType = contentTypeHeader ?? undefined;

    const contentLengthHeader = this.raw.headers.get(HeaderField.ContentLength);
    this.contentLength = contentLengthHeader ? Math.floor(Number(contentLengthHeader)) : undefined;

    const xff = this.raw.headers.get(HeaderField.XForwardedFor);
    this.socketAddress = params.server.requestIP(this.raw) || undefined;
    this.ip = xff ? xff?.split(',')[0]?.trim() : this.raw.headers.get(HeaderField.XRealIp) || this.socketAddress?.address || undefined;
  }

  /**
   * Get the headers of the request
   * @returns The headers of the request
   */
  get headers() {
    return this.raw.headers;
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

  /**
   * Get the body of the request
   * @returns The body of the request
   */
  get body() {
    return this._body;
  }

  /**
   * Set the body of the request
   * @param body - The body of the request
   * @returns The request instance
   */
  setBody(body: any) {
    this._body = body;

    return this;
  }
}
