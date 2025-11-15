import { CookieMap } from 'bun';

import type { HttpMethod } from './enums';

export class BunnerRequest {
  readonly requestId: string;
  readonly httpMethod: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly headers: Headers;
  readonly protocol: string | null;
  readonly host: string | null;
  readonly hostname: string | null;
  readonly port: number | null;
  readonly queryString: string | null;
  readonly cookies: CookieMap;
  readonly contentType: string | null;
  readonly contentLength: number | null;
  readonly charset: string | null;
  readonly params: Record<string, any>;
  readonly queryParams: Record<string, any>;
  readonly body: unknown;
  readonly ip: string | null;
  readonly ips: string[];
  readonly isTrustedProxy: boolean;
  readonly subdomains: string[];

  constructor(_req: Request) {
    /*     this.requestId = req.requestId;
    this.httpMethod = req.httpMethod;
    this.url = req.url;
    this.path = req.path;
    this.headers = new Headers(req.headers);
    this.cookies = new CookieMap(req.cookies);
    this.protocol = req.protocol ?? null;
    this.host = req.host ?? null;
    this.hostname = req.hostname ?? null;
    this.port = req.port ?? null;
    this.queryString = req.queryString ?? null;
    this.contentType = req.contentType ?? null;
    this.contentLength = req.contentLength ?? null;
    this.charset = req.charset ?? null;
    this.params = req.params;
    this.queryParams = req.queryParams;
    this.body = req.body ?? null;
    this.isTrustedProxy = req.isTrustedProxy;
    this.subdomains = req.subdomains;
    this.ip = req.ip ?? null;
    this.ips = req.ips;
 */
  }
}
