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
 * Header Field
 * @description The header field
 */
export enum HeaderField {
  SetCookie = 'set-cookie',
  ContentType = 'content-type',
  Location = 'location',
  XForwardedFor = 'x-forwarded-for',
  XRealIp = 'x-real-ip',
}

export enum ContentType {
  Text = 'text/plain',
  Json = 'application/json',
}
