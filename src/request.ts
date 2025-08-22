import type { BunRequest, Server, SocketAddress } from 'bun';
import qs from 'qs';
import type { BunnerRequestConstructorParams } from './interfaces';

export class BunnerRequest {
  readonly raw: BunRequest;
  readonly headers: Record<string, string>;
  readonly body: any;
  readonly bodyType: 'json' | 'text';
  readonly query: Record<string, string>;
  readonly hostname: string;
  readonly host: string;
  readonly protocol: string;
  readonly path: string;
  readonly ip: string | undefined;
  readonly socketAddress: SocketAddress | undefined;

  constructor(params: BunnerRequestConstructorParams) {
    /**
     * Initialize from params
     */
    this.raw = params.req;
    this.headers = {};
    this.body = params.body;

    params.headers.forEach((val: string, key: string) => {
      this.headers[key.toLowerCase()] = val;
    });

    /**
     * Initialize request information of the request
     */
    const parsed = new URL(this.url);

    this.query = qs.parse(parsed.search.slice(1));
    this.hostname = parsed.hostname;
    this.host = parsed.host;
    this.protocol = parsed.protocol.slice(0, -1);
    this.path = parsed.pathname;

    const xff = this.headers['x-forwarded-for'];

    this.socketAddress = params.server.requestIP(this.raw) || undefined;
    this.ip = xff ? xff?.split(',')[0]?.trim() : this.raw.headers.get('x-real-ip') || this.socketAddress?.address || undefined;
  }

  static async fromBunRequest(req: BunRequest, server: Server) {
    let body: any;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      body = await req.text();
    }

    return new BunnerRequest({ req, server, headers: req.headers, body });
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
   * Get the params of the request
   * @returns The params of the request
   */
  get params() {
    return this.raw.params;
  }

  /**
   * Get the cookies of the request
   * @returns The cookies of the request
   */
  get cookies() {
    return this.raw.cookies;
  }

  /**
   * Get the port of the request
   * @returns The port of the request
   */
  get port() {
    return this.socketAddress?.port;
  }

  /**
   * Get the family of the request
   * @returns The family of the request
   */
  get family() {
    return this.socketAddress?.family;
  }
}
