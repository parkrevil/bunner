import { CookieMap } from 'bun';

import { HttpMethod } from './enums';

export class BunnerRequest {
  public readonly requestId: string;
  public readonly httpMethod: HttpMethod;
  public readonly url: string;
  public readonly path: string;
  public readonly headers: Headers;
  public readonly protocol: string | null;
  public readonly host: string | null;
  public readonly hostname: string | null;
  public readonly port: number | null;
  public readonly queryString: string | null;
  public readonly cookies: CookieMap;
  public readonly contentType: string | null;
  public readonly contentLength: number | null;
  public readonly charset: string | null;
  public readonly params: Record<string, any>;
  public readonly body: unknown;
  public readonly ip: string | null;
  public readonly ips: string[];
  public readonly isTrustedProxy: boolean;
  public readonly subdomains: string[];
  public query: Record<string, any>;

  get method(): string {
    return this.httpMethod;
  }

  constructor(req: any) {
    const urlObj = new URL(req.url);

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
    this.query = req.query || {};
    this.body = req.body ?? null;
    this.isTrustedProxy = req.isTrustedProxy || false;
    this.subdomains = [];
    this.ip = req.ip ?? null;
    this.ips = req.ips || [];
  }
}
