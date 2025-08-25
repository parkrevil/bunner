import { StatusCodes } from 'http-status-codes';
import { HeaderField, HttpMethod, type HttpMethodType } from 'src/web-application';
import type { MiddlewareFn } from '../../types';
import { BunnerRequest } from '../../web-application/request';
import { BunnerResponse } from '../../web-application/response';
import type { CorsOptions } from './interfaces';

async function isOriginAllowed(origin: string, allowedOrigins: CorsOptions['origin']): Promise<boolean> {
  if (allowedOrigins === true || allowedOrigins === '*') {
    return true;
  }

  if (allowedOrigins instanceof RegExp) {
    return allowedOrigins.test(origin);
  }

  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.some(allowed =>
      typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
    );
  }

  if (typeof allowedOrigins === 'function') {
    const result = allowedOrigins(origin);

    return result instanceof Promise ? await result : result;
  }

  return origin === allowedOrigins;
};

export function cors(options: CorsOptions): MiddlewareFn {
  const {
    origin = '*',
    methods = [HttpMethod.Get, HttpMethod.Head, HttpMethod.Put, HttpMethod.Patch, HttpMethod.Post, HttpMethod.Delete],
    allowedHeaders = ['Content-Type', 'Authorization'],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400,
    optionsSuccessStatus = 204,
  } = options;
  const headerSeperator = ', ';
  const normalizedMethods = methods.join(headerSeperator);
  const normalizedAllowedHeaders = allowedHeaders.join(headerSeperator);
  const normalizedExposedHeaders = exposedHeaders.join(headerSeperator);

  return async (req: BunnerRequest, res: BunnerResponse, next: () => void) => {
    const requestOrigin = req.headers.get(HeaderField.Origin);
    const method = req.method.toUpperCase();
    const isPreflight = method === HttpMethod.Options;

    if (!requestOrigin) {
      return next();
    }

    let errorCode: StatusCodes | undefined;

    if (!await isOriginAllowed(requestOrigin, origin)) {
      errorCode = StatusCodes.FORBIDDEN;
    } else if (!isPreflight && !methods.includes(method as HttpMethodType)) {
      errorCode = StatusCodes.METHOD_NOT_ALLOWED;
    }

    if (!!errorCode) {
      return res.setHeader(HeaderField.AccessControlAllowOrigin, 'https://not-allowed.com').setStatus(errorCode).end();
    }

    res.setHeader(HeaderField.Vary, 'Origin');

    if (credentials) {
      res.setHeaders({
        [HeaderField.AccessControlAllowOrigin]: requestOrigin,
        [HeaderField.AccessControlAllowCredentials]: 'true',
      });
    } else {
      res.setHeader(HeaderField.AccessControlAllowOrigin, '*');
    }

    if (isPreflight) {
      return res
        .setHeaders({
          [HeaderField.AccessControlAllowMethods]: normalizedMethods,
          [HeaderField.AccessControlAllowHeaders]: normalizedAllowedHeaders,
          [HeaderField.AccessControlMaxAge]: maxAge.toString(),
        })
        .setStatus(optionsSuccessStatus)
        .end();
    }

    if (normalizedExposedHeaders.length) {
      res.setHeader(HeaderField.AccessControlExposeHeaders, normalizedExposedHeaders!);
    }

    next();
  };
}