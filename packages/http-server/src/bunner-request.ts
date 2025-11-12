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

  constructor(ffiReq: FfiBunnerRequest) {
    this.requestId = ffiReq.requestId;
    this.httpMethod = ffiReq.httpMethod;
    this.url = ffiReq.url;
    this.path = ffiReq.path;
    this.headers = new Headers(ffiReq.headers);
    this.cookies = new CookieMap(ffiReq.cookies);
    this.protocol = ffiReq.protocol ?? null;
    this.host = ffiReq.host ?? null;
    this.hostname = ffiReq.hostname ?? null;
    this.port = ffiReq.port ?? null;
    this.queryString = ffiReq.queryString ?? null;
    this.contentType = ffiReq.contentType ?? null;
    this.contentLength = ffiReq.contentLength ?? null;
    this.charset = ffiReq.charset ?? null;
    this.params = ffiReq.params;
    this.queryParams = ffiReq.queryParams;
    this.body = ffiReq.body ?? null;
    this.isTrustedProxy = ffiReq.isTrustedProxy;
    this.subdomains = ffiReq.subdomains;
    this.ip = ffiReq.ip ?? null;
    this.ips = ffiReq.ips;
  }
}
