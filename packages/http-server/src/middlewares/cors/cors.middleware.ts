import { type Context, type Middleware } from '@bunner/core';

import { isHttpContext } from '../../adapter';
import { HeaderField, HttpMethod } from '../../enums';

import { CORS_DEFAULT_METHODS, CORS_DEFAULT_OPTIONS_SUCCESS_STATUS } from './constants';
import type { CorsOptions } from './interfaces';
import type { CustomOriginFn } from './types';

export class CorsMiddleware implements Middleware {
  constructor(private readonly options: CorsOptions = {}) {}

  public async handle(ctx: Context): Promise<boolean | void> {
    if (!isHttpContext(ctx)) {
      return;
    }

    const req = ctx.request;
    const res = ctx.response;

    const origin = req.headers.get(HeaderField.Origin);
    const method = req.method;

    // Set defaults
    const allowedMethods = this.options.methods || CORS_DEFAULT_METHODS;
    const allowedHeaders = this.options.allowedHeaders;
    const exposedHeaders = this.options.exposedHeaders;
    const allowCredentials = this.options.credentials;
    const maxAge = this.options.maxAge;
    const preflightContinue = this.options.preflightContinue || false;
    const optionsSuccessStatus = this.options.optionsSuccessStatus || CORS_DEFAULT_OPTIONS_SUCCESS_STATUS;

    // Handle Origin
    if (!origin) {
      return;
    }

    // Validate Origin and set header
    const allowedOrigin = await this.matchOrigin(origin, this.options);

    if (!allowedOrigin) {
      return;
    }

    res.setHeader(HeaderField.AccessControlAllowOrigin, allowedOrigin);
    // If we echo the origin, we must set Vary: Origin
    if (allowedOrigin !== '*') {
      res.appendHeader(HeaderField.Vary, HeaderField.Origin);
    }

    // Credentials
    if (allowCredentials) {
      res.setHeader(HeaderField.AccessControlAllowCredentials, 'true');
    }

    // Exposed Headers (Actual Request)
    if (exposedHeaders && exposedHeaders.length > 0) {
      res.setHeader(
        HeaderField.AccessControlExposeHeaders,
        Array.isArray(exposedHeaders) ? exposedHeaders.join(',') : exposedHeaders,
      );
    }

    // Handle Preflight
    if (method === (HttpMethod.Options as string)) {
      // Access-Control-Request-Method
      const requestMethod = req.headers.get(HeaderField.AccessControlRequestMethod);
      if (!requestMethod) {
        // Proceed if not a valid preflight
        return;
      }

      // Access-Control-Allow-Methods
      if (allowedMethods) {
        res.setHeader(
          HeaderField.AccessControlAllowMethods,
          Array.isArray(allowedMethods) ? allowedMethods.join(',') : allowedMethods,
        );
      }

      // Access-Control-Allow-Headers
      if (allowedHeaders) {
        res.setHeader(
          HeaderField.AccessControlAllowHeaders,
          Array.isArray(allowedHeaders) ? allowedHeaders.join(',') : allowedHeaders,
        );
      } else {
        // If not specified, reflect request headers
        const requestHeaders = req.headers.get(HeaderField.AccessControlRequestHeaders);
        if (requestHeaders) {
          res.setHeader(HeaderField.AccessControlAllowHeaders, requestHeaders);
          res.appendHeader(HeaderField.Vary, HeaderField.AccessControlRequestHeaders);
        }
      }

      // Access-Control-Max-Age
      if (maxAge !== undefined) {
        res.setHeader(HeaderField.AccessControlMaxAge, maxAge.toString());
      }

      if (preflightContinue) {
        return;
      }

      // End response with success status
      res.setStatus(optionsSuccessStatus);
      return false;
    }
  }

  private async matchOrigin(origin: string, options: CorsOptions): Promise<string | undefined> {
    if (options.origin === false) {
      return undefined;
    }

    if (options.origin === undefined || options.origin === '*') {
      return options.credentials ? origin : '*';
    }

    if (typeof options.origin === 'string') {
      return options.origin === origin ? options.origin : undefined;
    }

    if (typeof options.origin === 'boolean') {
      return options.origin ? origin : undefined;
    }

    if (options.origin instanceof RegExp) {
      return options.origin.test(origin) ? origin : undefined;
    }

    if (Array.isArray(options.origin)) {
      const matched = options.origin.some(o => {
        if (o instanceof RegExp) {
          return o.test(origin);
        }
        return o === origin;
      });
      return matched ? origin : undefined;
    }

    if (typeof options.origin === 'function') {
      return new Promise<string | undefined>(resolve => {
        (options.origin as CustomOriginFn)(origin, (err, allow) => {
          if (err || !allow) {
            resolve(undefined);
          } else {
            resolve(origin);
          }
        });
      });
    }

    return undefined;
  }
}
