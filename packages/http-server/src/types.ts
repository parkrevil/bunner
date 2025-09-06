import type { codes as HttpStatusCode } from 'statuses';

import type { HTTP_METHOD } from './constants';

/**
 * HTTP Status Code
 * @description The HTTP status code
 */
export type HttpStatusCode = (typeof HttpStatusCode)[number];

/**
 * HTTP Method Value
 * @description The HTTP method value
 */
export type HttpMethodValue = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD];

/**
 * Handler Function
 * @description The handler function
 */
export type HandlerFunction = (...args: any[]) => any;
