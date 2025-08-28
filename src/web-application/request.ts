import type { CookieMap, SocketAddress } from 'bun';
import { HeaderField, Protocol } from './constants';
import type { BunnerRequestConstructorParams } from './interfaces';
import type { ProtocolValue } from './types';

export class BunnerRequest {
  readonly raw: Request;
  readonly protocol: ProtocolValue;
  readonly path: string;
  readonly contentType: string | undefined;
  readonly contentLength: number | undefined;
  readonly params: Record<string, any>;
  readonly ip: string | undefined;
  readonly socketAddress: SocketAddress | undefined;

  private readonly _customData: Map<string, any> = new Map<string, any>();
  private _isHttps: boolean;
  private _queryParams: Record<string, string>;
  private _body: any;
  private _cookies: CookieMap | undefined;

  constructor(params: BunnerRequestConstructorParams) {
    this.raw = params.request;
    this.params = params.params;
    this._queryParams = params.queryParams;

    const url = new URL(this.raw.url);
    this.path = url.pathname;
    this.protocol = url.protocol.split(':')[0] as ProtocolValue;

    const contentTypeHeader = this.raw.headers.get(HeaderField.ContentType);
    this.contentType = contentTypeHeader ?? undefined;

    const contentLengthHeader = this.raw.headers.get(HeaderField.ContentLength);
    this.contentLength = contentLengthHeader ? Math.floor(Number(contentLengthHeader)) : undefined;

    const xff = this.raw.headers.get(HeaderField.XForwardedFor);
    this.socketAddress = params.server.requestIP(this.raw) || undefined;
    this.ip = xff ? xff?.split(',')[0]?.trim() : this.raw.headers.get(HeaderField.XRealIp) || this.socketAddress?.address || undefined;

    const xfProto = this.headers.get(HeaderField.XForwardedProto) ?? '';
    this._isHttps = xfProto.toLowerCase().includes(Protocol.Https) || this.protocol === Protocol.Https;
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
   * Get the query params of the request
   * @returns The query params of the request
   */
  get queryParams() {
    return this._queryParams;
  }

  /**
   * Get the body of the request
   * @returns The body of the request
   */
  get body() {
    return this._body;
  }

  /**
   * Get the cookies of the request
   * @returns The cookies of the request
   */
  get cookies() {
    return this._cookies;
  }

  /**
   * Check if the request is HTTPS
   * @returns True if the request is HTTPS, false otherwise
   */
  isHttps() {
    return this._isHttps;
  }

  /**
   * Set the cookies of the request
   * @param cookies - The cookies of the request
   * @returns The request instance
   */
  setCookies(cookies: CookieMap | undefined) {
    this._cookies = cookies;

    return this;
  }

  /**
   * Set the query params of the request
   * @param queryParams - The query params of the request
   * @returns The request instance
   */
  setQueryParams(queryParams: Record<string, string>) {
    this._queryParams = queryParams;

    return this;
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

  /**
   * Attach arbitrary data to the request lifecycle.
   * @param key - The key to store the value under.
   * @param value - The value to store.
   * @returns The request instance.
   */
  setCustomData<TValue>(key: string, value: TValue) {
    this._customData.set(key, value);

    return this;
  }

  /**
   * Retrieve previously stored custom data from the request.
   * @param key - The key of the value to retrieve.
   * @returns The stored value or undefined.
   */
  getCustomData<TValue>(key: string): TValue | undefined {
    return this._customData.get(key) as TValue | undefined;
  }
}
