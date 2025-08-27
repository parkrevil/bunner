import { HeaderField, HttpMethod } from '../../constants';
import type { Middleware } from '../../providers/middleware';
import type { CorsOptions } from './interfaces';

async function isOriginAllowed(origin: string, allowedOrigins: CorsOptions['origin']): Promise<boolean> {
  if (allowedOrigins === true || allowedOrigins === '*') return true;
  if (allowedOrigins instanceof RegExp) return allowedOrigins.test(origin);
  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.some((allowed) => (typeof allowed === 'string' ? allowed === origin : allowed.test(origin)));
  }
  if (typeof allowedOrigins === 'function') {
    const result = allowedOrigins(origin);
    return result instanceof Promise ? await result : result;
  }
  if (typeof allowedOrigins === 'string') return origin === allowedOrigins;
  return false;
}

export function cors(options: CorsOptions = {}): Middleware {
  const originOpt = options.origin ?? true;
  const methodsOpt = (options.methods ?? [HttpMethod.Get, HttpMethod.Head, HttpMethod.Put, HttpMethod.Patch, HttpMethod.Post, HttpMethod.Delete]).map((m) => m.toUpperCase());
  const allowedHeadersOpt: string[] | undefined = options.allowedHeaders;
  const exposedHeadersOpt: string[] | undefined = options.exposedHeaders;
  const credentialsOpt = options.credentials ?? false;
  const maxAgeOpt = options.maxAge;
  const optionsSuccessStatus = options.optionsSuccessStatus ?? 204;
  const preflightContinue = options.preflightContinue ?? false;

  const methodsHeader = methodsOpt.join(', ');
  const allowedHeadersHeader = (allowedHeadersOpt ?? []).join(', ');
  const exposedHeadersHeader = (exposedHeadersOpt ?? []).join(', ');

  return async (req, res) => {
    const requestOrigin = req.headers.get(HeaderField.Origin) || undefined;
    const method = req.method.toUpperCase();
    const isPreflight = method === HttpMethod.Options;

    if (!requestOrigin) {
      return;
    }

    const isAllowed = await isOriginAllowed(requestOrigin, originOpt as any);
    if (!isAllowed) {
      return;
    }

    const acrHeaders = req.headers.get(HeaderField.AccessControlRequestHeaders) || undefined;
    const varyParts: string[] = [HeaderField.Origin];

    if (!allowedHeadersOpt && acrHeaders) varyParts.push(HeaderField.AccessControlRequestHeaders);
    res.setHeader(HeaderField.Vary, varyParts.join(', '));

    if (originOpt === '*') {
      res.setHeader(HeaderField.AccessControlAllowOrigin, credentialsOpt ? requestOrigin! : '*');
    } else {
      res.setHeader(HeaderField.AccessControlAllowOrigin, requestOrigin!);
    }

    if (credentialsOpt) {
      res.setHeader(HeaderField.AccessControlAllowCredentials, 'true');
    }

    if (isPreflight) {
      res.setHeader(HeaderField.AccessControlAllowMethods, methodsHeader);

      if (allowedHeadersOpt && allowedHeadersOpt.length) {
        res.setHeader(HeaderField.AccessControlAllowHeaders, allowedHeadersHeader);
      } else if (acrHeaders) {
        res.setHeader(HeaderField.AccessControlAllowHeaders, acrHeaders);
      }

      if (typeof maxAgeOpt === 'number') {
        res.setHeader(HeaderField.AccessControlMaxAge, String(maxAgeOpt));
      }

      if (preflightContinue) {
        return;
      }

      return res.setStatus(optionsSuccessStatus);
    }

    if (exposedHeadersOpt && exposedHeadersOpt.length) {
      res.setHeader(HeaderField.AccessControlExposeHeaders, exposedHeadersHeader);
    }

    return;
  };
}