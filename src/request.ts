import { BunRequest } from 'bun';
import qs from 'qs';

export class BunnerRequest {
  raw: BunRequest;
  query: Record<string, string>;
  hostname: string;
  host: string;
  protocol: string;
  path: string;

  constructor(req: BunRequest) {
    this.raw = req;

    const parsedUrl = new URL(req.url);
    this.query = qs.parse(parsedUrl.search.slice(1));
    this.hostname = parsedUrl.hostname;
    this.host = parsedUrl.host;
    this.protocol = parsedUrl.protocol.slice(0, -1);
    this.path = parsedUrl.pathname;
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
   * Get the headers of the request
   * @returns The headers of the request
   */
  get headers() {
    return this.raw.headers;
  }

  /**
   * Get the body of the request
   * @returns The body of the request
   */
  get body() {
    return this.raw.body;
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
   * Get the JSON body of the request
   * @returns The JSON body of the request
   */
  json() {
    return this.raw.json();
  }

  /**
   * Get the text body of the request
   * @returns The text body of the request
   */
  text() {
    return this.raw.text();
  }
}
