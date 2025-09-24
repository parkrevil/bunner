import { CookieMap } from 'bun';

import type { HttpMethod } from './enums';
import type { FfiBunnerRequest } from './ffi';

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
  readonly cookies: CookieMap;
  readonly contentType: string | null;
  readonly contentLength: number | null;
  readonly charset: string | null;
  readonly params: Record<string, any> | null;
  readonly queryParams: Record<string, any> | null;
  readonly body: unknown;
  readonly ip: string | null;
  readonly ips: string[] | null;
  readonly isTrustedProxy: boolean;
  readonly subdomains: string[] | null;

  constructor(ffiReq: FfiBunnerRequest, rawReq: Request) {
    this.requestId = ffiReq.requestId;
    this.httpMethod = ffiReq.httpMethod;
    this.url = rawReq.url;
    this.path = ffiReq.path;
    this.headers = new Headers(rawReq.headers);
    this.cookies = new CookieMap(ffiReq.cookies);
    this.protocol = ffiReq.protocol ?? null;
    this.host = ffiReq.host ?? null;
    this.hostname = ffiReq.hostname ?? null;
    this.port = ffiReq.port ?? null;
    this.contentType = ffiReq.contentType ?? null;
    this.contentLength = ffiReq.contentLength ?? null;
    this.charset = ffiReq.charset ?? null;
    this.params = ffiReq.params ?? null;
    this.queryParams = ffiReq.queryParams ?? null;
    this.body = ffiReq.body ?? null;
    this.isTrustedProxy = ffiReq.isTrustedProxy;
    this.subdomains = ffiReq.subdomains ?? null;
    this.ip = ffiReq.ip ?? null;
    this.ips = ffiReq.ips ?? null;
  }
}
