import { CookieMap, type CookieInit } from 'bun';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

import type { BunnerRequest } from './bunner-request';
import { ContentType, HeaderField, HttpMethod } from './enums';
import type { FfiBunnerResponse } from './ffi';
import type { HttpWorkerResponse } from './interfaces';

export class BunnerResponse {
  private readonly req: BunnerRequest;
  private _body: any;
  private _cookies: CookieMap;
  private _headers: Headers;
  private _status: StatusCodes;
  private _statusText: string;
  private _workerResponse: HttpWorkerResponse;

  constructor(req: BunnerRequest, ffiRes: FfiBunnerResponse) {
    this.req = req;
    this._headers = new Headers(ffiRes.headers);
    this._cookies = new CookieMap(ffiRes.headers[HeaderField.SetCookie] ?? {});

    if (ffiRes.status) {
      this.setStatus(ffiRes.status).end();
    }
  }

  isSent() {
    return this._workerResponse !== undefined;
  }

  getWorkerResponse() {
    return this._workerResponse;
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

  end(): HttpWorkerResponse {
    if (this.isSent()) {
      return this._workerResponse;
    }

    this.build();

    return this._workerResponse;
  }

  build(): BunnerResponse {
    if (this.isSent()) {
      return this;
    }

    if (this.getHeader(HeaderField.Location)) {
      if (!this._status) {
        this.setStatus(StatusCodes.MOVED_PERMANENTLY);
      }

      return this.setBody(undefined).buildWorkerResponse();
    }

    if (!this.getContentType()) {
      this.setContentType(this.inferContentType());
    }

    const contentType = this.getContentType();

    if (this.req.httpMethod === HttpMethod.Head) {
      if (!this._status) {
        this.setStatus(StatusCodes.OK);
      }

      return this.setBody(undefined).buildWorkerResponse();
    }

    if (this._status === StatusCodes.NO_CONTENT || this._status === StatusCodes.NOT_MODIFIED) {
      return this.setBody(undefined).buildWorkerResponse();
    }

    if (!this._status && (this._body === null || this._body === undefined)) {
      return this.setStatus(StatusCodes.NO_CONTENT).setBody(undefined).buildWorkerResponse();
    }

    if (contentType?.startsWith(ContentType.Json)) {
      try {
        this.setBody(JSON.stringify(this._body));
      } catch {
        this.setContentType(ContentType.Text).setBody(String(this._body));
      }
    }

    return this.buildWorkerResponse();
  }

  /**
   * Build the response for the worker.
   * @description This method finalizes the response by setting cookies and preparing the body and headers for sending to the worker.
   */
  private buildWorkerResponse(): BunnerResponse {
    if (this._cookies.size > 0) {
      this.setHeader(HeaderField.SetCookie, this._cookies.toSetCookieHeaders().join(', '));
    }

    this._workerResponse = {
      body: this._body,
      init: {
        status: this._status,
        statusText: this._statusText,
        headers: this._headers.toJSON(),
      },
    };

    return this;
  }

  /**
   * Infer content type based on current body value.
   */
  private inferContentType() {
    if (
      this._body !== null &&
      (typeof this._body === 'object' ||
        Array.isArray(this._body) ||
        typeof this._body === 'number' ||
        typeof this._body === 'boolean')
    ) {
      return ContentType.Json;
    }

    return ContentType.Text;
  }
}
