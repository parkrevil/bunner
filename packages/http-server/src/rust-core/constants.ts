/**
 * HTTP Server Error Codes
 * @description The HTTP server error codes
 */
export const HttpServerErrorCodes: Record<number, string> = {
  // HTTP Server
  1: 'Handle is null.',
  2: 'Internal server error occurred.',
  3: 'Invalid HTTP method.',
  4: 'Invalid JSON string.',
  5: 'Invalid request id.',

  // Router
  // Add-time
  10001: 'A route with the same path already exists.',
  10002: 'The route path syntax is invalid.',
  10003: 'Wildcard segments are only allowed at the end of the path.',
  10004: 'The path contains disallowed characters.',
  10005: 'Duplicate parameter names exist in the route path.',
  10006: 'The router is sealed and cannot accept new routes.',
  10007: 'Parameter name conflict at the same position in the path.',
  10008: 'The route path is empty.',
  10009: 'The route path must contain only ASCII characters.',
  10010: 'Parameter name starts with an invalid character.',
  10011: 'Parameter name contains disallowed characters.',
  10012: 'A segment contains both a parameter and a literal.',
  10013: 'A wildcard route already exists for this method.',
  10014: 'The maximum number of routes has been exceeded.',
  10015: 'The route pattern is too long.',
  // Match time
  10101: 'No matching route found.',
  10102: 'The request path contains disallowed characters.',
  10103: 'The request path is empty.',
  10104: 'The request path must contain only ASCII characters.',
  // Server runtime
  8: 'Router is not sealed.',
  9: 'Job queue is full.',
} as const;
