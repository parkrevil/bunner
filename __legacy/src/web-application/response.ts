import { CookieMap, type CookieInit } from 'bun';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { ContentType, HeaderField, HttpMethod } from './constants';
import type { BunnerRequest } from './request';
import type { ContentTypeValue } from './types';

export class BunnerResponse {
  private readonly req: BunnerRequest;
  private _body: any;
  private _cookies: CookieMap;
  private _headers: Headers;
  private _status;
  private _statusText;
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
    return this.getHeader(HeaderField.ContentType) as ContentTypeValue | undefined;
  }

  setContentType(contentType: ContentTypeValue, charset?: string) {
    this.setHeader(HeaderField.ContentType, `${contentType}${charset ? `; charset=${charset}` : ''}`);

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

    let contentType = this.getContentType();

    if (!contentType) {
      contentType = this.inferContentType();

      const needsCharset =
        contentType.startsWith('text/') ||
        contentType === ContentType.Json ||
        contentType === ContentType.Javascript;

      this.setContentType(contentType, needsCharset ? 'utf-8' : undefined);
    }

    if (this.req.method === HttpMethod.Head) {
      if (!this._status) {
        this.setStatus(StatusCodes.OK);
      }

      this._body = undefined;
      this._built = true;

      return this;
    }

    if (this._status === StatusCodes.NO_CONTENT || this._status === StatusCodes.NOT_MODIFIED) {
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

    if (contentType === ContentType.Json && typeof this._body !== 'string' && !(this._body instanceof Uint8Array) && !(this._body instanceof ArrayBuffer)) {
      try {
        this._body = JSON.stringify(this._body);
      } catch {
        this.setContentType(ContentType.Text, 'utf-8');

        this._body = String(this._body);
      }
    }

    if (contentType.startsWith('text/') && typeof this._body !== 'string') {
      this._body = String(this._body);
    }

    if (this._body && typeof (this._body as any)?.name === 'string' && !this.getHeader(HeaderField.ContentDisposition)) {
      this.setHeader(HeaderField.ContentDisposition, `attachment; filename="${(this._body as any).name}"`);
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
  private inferContentType(): ContentTypeValue {
    if (typeof this._body === 'string') {
      return ContentType.Text as ContentTypeValue;
    }

    if (this._body instanceof Blob) {
      return ((this._body as Blob).type || ContentType.OctetStream) as ContentTypeValue;
    }

    if (this._body instanceof ArrayBuffer || this._body instanceof Uint8Array) {
      return ContentType.OctetStream as ContentTypeValue;
    }

    if (typeof ReadableStream !== 'undefined' && this._body instanceof ReadableStream) {
      return ContentType.OctetStream as ContentTypeValue;
    }

    if (this._body !== null && (typeof this._body === 'object' || typeof this._body === 'number' || typeof this._body === 'boolean')) {
      return ContentType.Json as ContentTypeValue;
    }

    return ContentType.Text as ContentTypeValue;
  }

  private makeResponseInit() {
    if (this._cookies.size > 0) {
      this.setHeader(HeaderField.SetCookie, this._cookies.toSetCookieHeaders().join(', '));
    }

    return {
      status: this._status,
      statusText: this._statusText,
      headers: this._headers,
    } as ResponseInit;
  }
}