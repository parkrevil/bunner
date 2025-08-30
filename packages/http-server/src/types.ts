import type { codes as HttpStatusCode } from 'statuses';

/**
 * HTTP Status Code
 * @description The HTTP status code
 */
export type HttpStatusCode = (typeof HttpStatusCode)[number];

/**
 * HTTP Method
 * @description The HTTP method
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
