import { CookieMap, type CookieInit } from 'bun';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

import type { BunnerRequest } from './bunner-request';
import { ContentType, HeaderField, HttpMethod } from './enums';

export class BunnerResponse {
  private readonly req: BunnerRequest;
  private _body: any;
  private _cookies: CookieMap;
  private _headers: Headers;
  private _status: StatusCodes;
  private _statusText: string;
  private _built = false;

  constructor(req: BunnerRequest) {
    this.req = req;
    this._headers = new Headers();
    this._cookies = new CookieMap();
  }

  getStatus() {
    return this._status;
  }

  setStatus(status: StatusCodes, statusText?: string) {
    this._status = status;
    this._statusText = statusText ?? getReasonPhrase(status);

    return this;
  }

  getHeader(name: string) {
    return this._headers.get(name);
  }

  setHeader(name: string, value: string) {
    this._headers.set(name, value);

    return this;
  }

  setHeaders(headers: Record<string, string>) {
    Object.entries(headers).forEach(([name, value]) => {
      this._headers.set(name, value);
    });

    return this;
  }

  appendHeader(name: string, value: string) {
    const existing = this._headers.get(name);

    if (existing) {
      this._headers.set(name, `${existing}, ${value}`);
    } else {
      this._headers.set(name, value);
    }

    return this;
  }

  removeHeader(name: string) {
    this._headers.delete(name);

    return this;
  }

  getContentType() {
    return this.getHeader(HeaderField.ContentType);
  }

  setContentType(contentType: string) {
    this.setHeader(HeaderField.ContentType, `${contentType}; charset=utf-8`);

    return this;
  }

  /**
   * Get the cookies set on the response.
   * @returns The cookies set on the response.
   */
  getCookies() {
    return this._cookies;
  }

  /**
   * Set a cookie on the response.
   * @param name - The name of the cookie.
   * @param value - The value of the cookie.
   * @param options - Options for serializing the cookie.
   * @returns The response instance.
   */
  setCookie(name: string, value: string, options?: CookieInit) {
    this._cookies.set(name, value, options);

    return this;
  }

  getBody() {
    return this._body;
  }

  setBody(data: any) {
    this._body = data ?? '';

    return this;
  }

  redirect(url: string) {
    this.setHeader(HeaderField.Location, url);

    return this;
  }

  build() {
    if (this._built) {
      return this;
    }

    const location = this.getHeader(HeaderField.Location);

    if (location) {
      if (!this._status) {
        this.setStatus(StatusCodes.MOVED_PERMANENTLY);
      }
      this._body = undefined;
      this._built = true;
      return this;
    }

    const contentType: string | undefined = this.getContentType() ?? undefined;

    if (contentType === undefined) {
      this.setContentType(this.inferContentType());
    }

    if (this.req.httpMethod === HttpMethod.Head) {
      if (!this._status) {
        this.setStatus(StatusCodes.OK);
      }

      this._body = undefined;
      this._built = true;

      return this;
    }

    if (
      this._status === StatusCodes.NO_CONTENT ||
      this._status === StatusCodes.NOT_MODIFIED
    ) {
      this._body = undefined;
      this._built = true;

      return this;
    }

    if (!this._status && (this._body === null || this._body === undefined)) {
      this.setStatus(StatusCodes.NO_CONTENT);
      this._body = undefined;
      this._built = true;

      return this;
    }

    if (contentType === ContentType.Json) {
      try {
        this._body = JSON.stringify(this._body);
      } catch {
        this.setContentType(ContentType.Text);

        this._body = String(this._body);
      }
    }

    this._built = true;

    return this;
  }

  toResponse() {
    return new Response(this._body, this.makeResponseInit());
  }

  /**
   * Infer content type based on current body value.
   */
  private inferContentType() {
    if (
      this._body !== null &&
      (typeof this._body === 'object' ||
        typeof this._body === 'number' ||
        typeof this._body === 'boolean')
    ) {
      return ContentType.Json;
    }

    return ContentType.Text;
  }

  private makeResponseInit() {
    if (this._cookies.size > 0) {
      this.setHeader(
        HeaderField.SetCookie,
        this._cookies.toSetCookieHeaders().join(', '),
      );
    }

    return {
      status: this._status,
      statusText: this._statusText,
      headers: this._headers,
    } as ResponseInit;
  }
}
