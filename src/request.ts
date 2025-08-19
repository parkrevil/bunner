import { BunRequest } from 'bun';
import qs from 'qs';

export class BunnerRequest {
  raw: BunRequest;
  headers: Record<string, string>;
  query: Record<string, string>;
  hostname: string;
  host: string;
  protocol: string;
  path: string;

  constructor(req: BunRequest) {
    this.raw = req;
    this.headers = {};

    this.raw.headers.forEach((val: string, key: string) => {
      this.headers[key.toLowerCase()] = val;
    });

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
   * Get the body of the request
   * @returns The body of the request
   */
  get body() {
    const contentType = this.raw.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return this.raw.json();
    }

    return this.raw.text(); // default to text
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
