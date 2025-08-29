import type { CookieInit } from 'bun';
import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import type { HttpMethodValue } from 'src/web-application/types';
import { HeaderField, HttpMethod } from '../../constants';
import type { Middleware } from '../../providers/middleware';
import { BunnerResponse } from '../../response';
import type { CsrfOptions } from './interfaces';

const SAFE_METHODS = new Set<HttpMethodValue>([HttpMethod.Get, HttpMethod.Head, HttpMethod.Options]);

export function csrf(options: CsrfOptions = {}): Middleware {
  const fieldName = options.fieldName ?? '_csrf';
  const cookieName = options.cookieName ?? '_csrf';
  const cookieOptions: CookieInit = {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
    ...options.cookieOptions,
  };

  return (req, res: BunnerResponse) => {
    const tokenFromCookie = req.cookies?.get(cookieName);

    if (!tokenFromCookie || SAFE_METHODS.has(req.method)) {
      const newToken = crypto.randomUUID();

      res.setCookie(cookieName, newToken, cookieOptions);
    }

    if (SAFE_METHODS.has(req.method)) {
      return;
    }

    const headerToken = req.headers.get(HeaderField.XCSRFToken)?.toString();
    const bodyToken = req.body && typeof req.body === 'object' && typeof req.body[fieldName] === 'string'
      ? req.body[fieldName]
      : undefined;
    const queryToken = typeof req.queryParams[fieldName] === 'string' ? req.queryParams[fieldName] : undefined;
    const clientToken = headerToken ?? bodyToken ?? queryToken;

    if (!clientToken || !tokenFromCookie || clientToken !== tokenFromCookie) {
      return res.setStatus(StatusCodes.FORBIDDEN);
    }
  };
}