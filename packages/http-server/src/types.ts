import type { codes as HttpStatusCode } from 'statuses';

import type { HttpMethod } from './constants';

/**
 * HTTP Status Code
 * @description The HTTP status code
 */
export type HttpStatusCode = (typeof HttpStatusCode)[number];

/**
 * HTTP Method Value
 * @description The HTTP method value
 */
export type HttpMethodValue = (typeof HttpMethod)[keyof typeof HttpMethod];
