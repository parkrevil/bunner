import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { ContentType, HeaderField } from './enums';
import { isObject } from './helpers';

export class BunnerResponse {
  private _body: any;
  private _headers: Headers;
  private _status = StatusCodes.OK;
  private _statusText = getReasonPhrase(StatusCodes.OK);
  private _response: Response;

  constructor() {
    this._headers = new Headers();
    this._status = StatusCodes.OK;
  }

  get status() {
    return this._status;
  }

  get body() {
    return this._body;
  }

  set body(data: any) {
    if (this._body) {
      return;
    }

    const contentType = this.getContentType();

    if (contentType) {
      this._body = data;
    } else if (isObject(data)) {
      this.setHeader(HeaderField.CONTENT_TYPE, ContentType.JSON);
      this._body = data;
    } else {
      this.setHeader(HeaderField.CONTENT_TYPE, ContentType.TEXT);
      this._body = data ?? '';
    }
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

  getContentType() {
    return this.getHeader(HeaderField.CONTENT_TYPE);
  }

  setContentType(contentType: ContentType) {
    this.setHeader(HeaderField.CONTENT_TYPE, contentType);

    return this;
  }

  /**
   * For express-like syntax
   * Set the content type of the response
   * @param contentType - The content type to set
   * @returns The response object
   */
  type(contentType: ContentType) {
    this.setContentType(contentType);

    return this;
  }

  setResponse(response: Response) {
    this._response = response;

    return this;
  }

  redirect(url: string) {
    this.setHeader(HeaderField.LOCATION, url);

    return this;
  }

  send(data?: any) {
    this.body = data;

    return this;
  }

  end(data?: any) {
    if (data !== undefined) {
      this.body = data;
    }

    return this.build();
  }

  private build() {
    if (this._response) {
      return this._response;
    }

    const location = this.getHeader(HeaderField.LOCATION);
    const contentType = this.getHeader(HeaderField.CONTENT_TYPE);
    const responseInit: ResponseInit = {
      status: this._status,
      statusText: this._statusText,
      headers: this._headers,
    };

    if (location) {
      return Response.redirect(location);
    } else if (contentType === ContentType.JSON) {
      return Response.json(this.body, responseInit);
    }

    return new Response(this.body, responseInit);
  }
}
