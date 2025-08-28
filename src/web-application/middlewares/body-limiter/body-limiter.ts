import { StatusCodes } from 'http-status-codes';
import { HeaderField } from '../../constants';
import type { Middleware } from '../../providers/middleware';
import type { BodyLimiterOptions } from './interfaces';

export function bodyLimiter(options: BodyLimiterOptions = {}): Middleware {
  const maxBytes = typeof options.maxBytes === 'number' && options.maxBytes > 0 ? options.maxBytes : undefined;

  if (!maxBytes) {
    return () => { };
  }

  return async (req, res) => {
    if (!req.raw.body) {
      return;
    }
    
    const contentLength = req.headers.get(HeaderField.ContentLength) ?? undefined;

    if (contentLength === undefined) {
      return;
    }

    const length = parseInt(contentLength, 10);

    if (isNaN(length) || length > maxBytes) {
      return res.setStatus(StatusCodes.REQUEST_TOO_LONG);
    }
  };
}
