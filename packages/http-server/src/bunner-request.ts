import { CookieMap } from 'bun';

import { HttpMethod } from './enums';

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

  get method(): string {
    return HttpMethod[this.httpMethod] || 'GET';
  }

  constructor(req: any) {
    const urlObj = new URL(req.url, 'http://localhost');

    this.requestId = req.requestId || Math.random().toString(36).substring(7);
    this.httpMethod = req.httpMethod;
    this.url = req.url;
    this.path = urlObj.pathname;
    this.headers = new Headers(req.headers);
    this.cookies = new CookieMap(this.headers.get('cookie') || '');
    this.protocol = urlObj.protocol.replace(':', '') || null;
    this.host = urlObj.host || null;
    this.hostname = urlObj.hostname || null;
    this.port = urlObj.port ? parseInt(urlObj.port) : null;
    this.queryString = urlObj.search || null;
    this.contentType = this.headers.get('content-type') || null;
    this.contentLength = this.headers.get('content-length') ? parseInt(this.headers.get('content-length')!) : null;
    this.charset = null;
    this.params = req.params || {};
    this.queryParams = req.queryParams || {};
    this.body = req.body ?? null;
    this.isTrustedProxy = req.isTrustedProxy || false;
    this.subdomains = [];
    this.ip = req.ip ?? null;
    this.ips = req.ips || [];
  }
}
