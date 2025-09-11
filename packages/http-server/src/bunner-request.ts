import { CookieMap, type Server } from 'bun';

import { HEADER_FIELD } from './constants';
import type { RustBunnerRequest } from './rust-core';
import type { HttpMethodValue } from './types';

export class BunnerRequest {
  readonly httpMethod: HttpMethodValue;
  readonly url: string;
  readonly path: string;
  readonly headers: Headers;
  readonly cookies: CookieMap;
  readonly contentType: string | undefined;
  readonly contentLength: number | undefined;
  readonly charset: string | undefined;
  readonly params: Record<string, any> | undefined;
  readonly queryParams: Record<string, any> | undefined;
  readonly body: Record<string, any> | undefined;
  readonly ip: string | undefined;

  constructor(rustReq: RustBunnerRequest, rawReq: Request, server: Server) {
    this.httpMethod = rustReq.httpMethod;
    this.url = rawReq.url;
    this.path = rustReq.path;
    this.headers = rawReq.headers;
    this.contentType = rustReq.contentType ?? undefined;
    this.contentLength = rustReq.contentLength ?? undefined;
    this.charset = rustReq.charset ?? undefined;
    this.params = rustReq.params ?? undefined;
    this.queryParams = rustReq.queryParams ?? undefined;
    this.body = rustReq.body ?? undefined;

    // Initialize the cookies
    this.cookies = new CookieMap();

    Object.entries(rustReq.cookies).forEach(([key, value]) => {
      this.cookies.set(key, value);
    });

    // Request IP
    const xff = this.headers.get(HEADER_FIELD.X_FORWARDED_FOR);
    const socketAddress = server.requestIP(rawReq) || undefined;

    this.ip = this.normalizeIp(
      xff
        ? xff?.split(',')[0]?.trim()
        : (rawReq.headers.get(HEADER_FIELD.X_REAL_IP) ??
            socketAddress?.address),
    );
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
