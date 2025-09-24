/**
 * Http Method
 * @description The HTTP method
 */
export enum HttpMethod {
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Options,
  Head,
}

/**
 * HTTP Protocol
 * @description The HTTP protocol
 */
export enum HttpProtocol {
  Http,
  Https,
}

/**
 * Header Field
 * @description The header field
 */
export enum HeaderField {
  SetCookie = 'set-cookie',
  ContentType = 'content-type',
  Location = 'location',
  Forwarded = 'forwarded',
  XForwardedFor = 'x-forwarded-for',
  XRealIp = 'x-real-ip',
}

/**
 * Content Type
 * @description The content type
 */
export enum ContentType {
  Text = 'text/plain',
  Json = 'application/json',
}
