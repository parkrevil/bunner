export enum ContentType {
  JSON = 'application/json',
  YAML = 'application/yaml',
  TEXT = 'text/plain',
  HTML = 'text/html',
  CSS = 'text/css',
  JS = 'application/javascript',
}

export enum HeaderField {
  LOCATION = 'Location',
  CONTENT_TYPE = 'Content-Type',
  CONTENT_LENGTH = 'Content-Length',
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
