import type { CookieInit } from 'bun';

export interface CsrfOptions {
  fieldName?: string;
  cookieName?: string;
  cookieOptions?: CookieInit;
}
