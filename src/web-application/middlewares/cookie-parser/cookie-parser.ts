import { CookieMap } from 'bun';
import { HeaderField } from '../../constants';
import type { Middleware } from '../../providers/middleware';

export function cookieParser(): Middleware {
  return (req, res) => {
    const cookies = req.headers.get(HeaderField.Cookie);

    if (!cookies || cookies.length === 0) {
      return;
    }

    req.setCookies(new CookieMap(cookies));
  };
}
