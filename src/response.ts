import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { ContentType, HeaderField } from './enums';
import { isObject } from './utils';

export class BunResponse {
  private _body: any;
  private _headers: Headers;
  private _status: StatusCodes;
  private _statusText: string;
  private _contentType: ContentType;

  get status() {
    return this._status;
  }

  get statusText() {
    return this._statusText;
  }

  get contentType() {
    return this._contentType;
  }

  set contentType(contentType: ContentType) {
    this._contentType = contentType;
  }

  get body() {
    return this._body;
  }

  set body(data: any) {
    if (isObject(data)) {
      this.setHeader(HeaderField.CONTENT_TYPE, ContentType.JSON);
      this._body = data;
    } else {
      this._body = data ?? '';
    }
  }

  setStatus(status: StatusCodes, statusText?: string) {
    this._status = status;
    this._statusText = statusText ?? getReasonPhrase(status.toString());

    return this;
  }

  getHeader(name: string) {
    return this._headers.get(name);
  }

  setHeader(name: string, value: string) {
    this._headers.set(name, value);

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

  redirect(url: string, status: StatusCodes) {
    this.setHeader(HeaderField.LOCATION, url);
    this.setStatus(status);

    return this;
  }

  send(data?: any) {
    this.body = data;

    return this;
  }

  end(data?: any) {
    this.body = data;

    return this.build();
  }

  private build() {
    const response = new Response(this.body, {
      status: this.status,
      headers: this._headers,
    });

    if (this.contentType === ContentType.JSON) {
      return response.json();
    } else {
      return response.text();
    }
  }
}
