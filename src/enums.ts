export enum ContentType {
  JSON = 'application/json',
  TEXT = 'text/plain',
  HTML = 'text/html',
  CSS = 'text/css',
  JS = 'application/javascript',
}

export enum HeaderField {
  CONTENT_TYPE = 'Content-Type',
  LOCATION = 'Location',
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
}
