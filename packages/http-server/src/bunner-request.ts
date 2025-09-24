import { CookieMap, type Server } from 'bun';

import { HeaderField } from './enums';
import type { HttpMethod } from './enums';
import type { FfiBunnerRequest } from './ffi';

export class BunnerRequest {
  readonly requestId: string;
  readonly httpMethod: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly headers: Headers;
  readonly protocol: string | undefined;
  readonly host: string | undefined;
  readonly hostname: string | undefined;
  readonly port: number | undefined;
  readonly cookies: CookieMap;
  readonly contentType: string | undefined;
  readonly contentLength: number | undefined;
  readonly charset: string | undefined;
  readonly params: Record<string, any> | undefined;
  readonly queryParams: Record<string, any> | undefined;
  readonly body: unknown;
  readonly ip: string | undefined;
  readonly ips: string[] | undefined;
  readonly isTrustedProxy: boolean;
  readonly subdomains: string[] | undefined;

  constructor(ffiReq: FfiBunnerRequest, rawReq: Request, server: Server) {
    this.requestId = ffiReq.requestId;
    this.httpMethod = ffiReq.httpMethod;
    this.url = rawReq.url;
    this.path = ffiReq.path;
    this.headers = new Headers(rawReq.headers);
    this.protocol = ffiReq.protocol ?? undefined;
    this.host = ffiReq.host ?? undefined;
    this.hostname = ffiReq.hostname ?? undefined;
    this.port = ffiReq.port ?? undefined;
    this.contentType = ffiReq.contentType ?? undefined;
    this.contentLength = ffiReq.contentLength ?? undefined;
    this.charset = ffiReq.charset ?? undefined;
    this.params = ffiReq.params ?? undefined;
    this.queryParams = ffiReq.queryParams ?? undefined;
    this.body = ffiReq.body ?? undefined;
    this.isTrustedProxy = ffiReq.isTrustedProxy;
    this.subdomains = ffiReq.subdomains ?? undefined;

    // Initialize the cookies
    this.cookies = new CookieMap();

    Object.entries(ffiReq.cookies).forEach(([key, value]) => {
      this.cookies.set(key, value);
    });

    // Request IP
    this.ip = ffiReq.ip ?? undefined;
    this.ips = ffiReq.ips ?? undefined;

    if (!this.ip) {
      const xff = this.headers.get(HeaderField.XForwardedFor);
      const socketAddress = server.requestIP(rawReq) || undefined;

      this.ip = this.normalizeIp(
        xff
          ? xff?.split(',')[0]?.trim()
          : (rawReq.headers.get(HeaderField.XRealIp) ?? socketAddress?.address),
      );
    }
  }

  /**
   * Normalize the IP address
   * @param ip - The IP address to normalize
   * @returns The normalized IP address
   */
  private normalizeIp(ip: string | undefined): string | undefined {
    if (!ip) {
      return undefined;
    }

    const withoutPort = ip.split(':').length > 2 ? ip : ip.split(':')[0];

    if (withoutPort?.startsWith('::ffff:')) {
      return withoutPort.slice(7);
    }

    return withoutPort;
  }
}
