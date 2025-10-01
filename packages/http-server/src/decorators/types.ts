/**
 * Route Handler Parameter Types
 * @description The types of parameters that can be injected into route handlers
 */
export type RouteHandlerParamType =
  | 'body'
  | 'param'
  | 'query'
  | 'header'
  | 'cookie'
  | 'request'
  | 'response'
  | 'ip';
