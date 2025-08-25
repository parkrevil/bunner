/**
 * Decorator Symbols
 */
// Class Decorators
export const RestControllerDecorator = Symbol('rest-controller');

// Controller Method Decorators
export const HttpMethodDecorator = Symbol('http-method');

/**
 * HTTP Methods
 */
export const HttpMethod = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
  Options: 'OPTIONS',
  Head: 'HEAD',
} as const;

export const ContentType = {
  Json: 'application/json',
  Yaml: 'application/yaml',
  Text: 'text/plain',
  Html: 'text/html',
  Css: 'text/css',
  JS: 'application/javascript',
  FormUrlencoded: 'application/x-www-form-urlencoded',
  MultipartFormData: 'multipart/form-data',
  OctetStream: 'application/octet-stream',
} as const;

export const HeaderField = {
  Location: 'location',
  ContentType: 'content-type',
  ContentLength: 'content-length',
  XForwardedFor: 'x-forwarded-for',
  XRealIp: 'x-real-ip',
  Origin: 'origin',
  AccessControlAllowOrigin: 'access-control-allow-origin',
  AccessControlAllowCredentials: 'access-control-allow-credentials',
  Vary: 'vary',
  AccessControlAllowMethods: 'access-control-allow-methods',
  AccessControlAllowHeaders: 'access-control-allow-headers',
  AccessControlMaxAge: 'access-control-max-age',
  AccessControlExposeHeaders: 'access-control-expose-headers',
} as const;
