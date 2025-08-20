import { StatusCodes } from 'http-status-codes';
import { HttpMethod } from '../../enums';
import { BunnerRequest } from '../../request';
import { BunnerResponse } from '../../response';
import { MiddlewareFn } from '../../types';
import { CorsOptions } from './interfaces';

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
    methods = [HttpMethod.GET, HttpMethod.HEAD, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.POST, HttpMethod.DELETE],
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
    const requestOrigin = req.headers['origin'];
    const method = req.method.toUpperCase();
    const isPreflight = method === HttpMethod.OPTIONS;

    if (!requestOrigin) {
      return next();
    }

    let errorCode: StatusCodes | undefined;

    if (!await isOriginAllowed(requestOrigin, origin)) {
      errorCode = StatusCodes.FORBIDDEN;
    } else if (!isPreflight && !methods.includes(method as HttpMethod)) {
      errorCode = StatusCodes.METHOD_NOT_ALLOWED;
    }

    if (!!errorCode) {
      return res.setHeader('Access-Control-Allow-Origin', 'https://not-allowed.com').setStatus(errorCode).end();
    }

    res.setHeader('Vary', 'Origin');

    if (credentials) {
      res.setHeaders({
        'Access-Control-Allow-Origin': requestOrigin,
        'Access-Control-Allow-Credentials': 'true',
      });
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    if (isPreflight) {
      return res
        .setHeaders({
          'Access-Control-Allow-Methods': normalizedMethods,
          'Access-Control-Allow-Headers': normalizedAllowedHeaders,
          'Access-Control-Max-Age': maxAge.toString(),
        })
        .setStatus(optionsSuccessStatus)
        .end();
    }

    if (normalizedExposedHeaders.length) {
      res.setHeader('Access-Control-Expose-Headers', normalizedExposedHeaders!);
    }

    next();
  };
}