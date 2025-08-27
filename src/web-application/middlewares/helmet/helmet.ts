import { HeaderField, Protocol } from '../../constants';
import type { Middleware } from '../../providers/middleware';
import type { BunnerRequest } from '../../request';
import type { HelmetOptions } from './interfaces';


export function helmet(options: HelmetOptions = {}): Middleware {
  const csp = options.contentSecurityPolicy === false ? undefined : options.contentSecurityPolicy;
  const cspReportOnly = options.contentSecurityPolicyReportOnly === false ? undefined : options.contentSecurityPolicyReportOnly;
  const coep = options.crossOriginEmbedderPolicy !== false ? (options.crossOriginEmbedderPolicy || { policy: 'require-corp' }) : undefined;
  const coop = options.crossOriginOpenerPolicy !== false ? (options.crossOriginOpenerPolicy || { policy: 'same-origin' }) : undefined;
  const corp = options.crossOriginResourcePolicy !== false ? (options.crossOriginResourcePolicy || { policy: 'same-origin' }) : undefined;
  const dns = options.dnsPrefetchControl !== false ? (options.dnsPrefetchControl || { allow: false }) : undefined;
  const frame = options.frameguard !== false ? (options.frameguard || { action: 'sameorigin' }) : undefined;
  const hsts = options.hsts !== false ? (options.hsts || { maxAge: 15552000, includeSubDomains: true }) : undefined;
  const noSniff = options.noSniff !== false;
  const ieNoOpen = options.ieNoOpen !== false;
  const hidePoweredByOpt = options.hidePoweredBy;
  const oac = options.originAgentCluster !== false;
  const pcdp = options.permittedCrossDomainPolicies !== false ? (options.permittedCrossDomainPolicies || { policy: 'none' }) : undefined;
  const ref = options.referrerPolicy !== false ? (options.referrerPolicy || { policy: 'no-referrer' }) : undefined;
  const xss = options.xssFilter !== false;
  const pp = options.permissionsPolicy !== false ? options.permissionsPolicy : undefined;
  const disableXfoIfCspPresent = options.disableXfoIfCspPresent === true;

  return (req, res) => {
    const removePoweredBy = hidePoweredByOpt === undefined || hidePoweredByOpt === true;
    const poweredByValue = typeof hidePoweredByOpt === 'object' ? hidePoweredByOpt.setTo : undefined;

    if (removePoweredBy) {
      res.removeHeader(HeaderField.XPoweredBy);
    }

    if (poweredByValue) {
      res.setHeader(HeaderField.XPoweredBy, poweredByValue);
    }

    if (noSniff) {
      res.setHeader(HeaderField.XContentTypeOptions, 'nosniff');
    }

    if (dns && typeof dns !== 'boolean') {
      res.setHeader(HeaderField.XDnsPrefetchControl, dns.allow ? 'on' : 'off');
    }

    if (ieNoOpen) {
      res.setHeader(HeaderField.XDownloadOptions, 'noopen');
    }

    if (frame && typeof frame !== 'boolean') {
      const hasFrameAncestors = !!(csp?.directives && 'frame-ancestors' in (csp.directives as Record<string, string | string[]>));

      if (!(disableXfoIfCspPresent && hasFrameAncestors)) {
        res.setHeader(HeaderField.XFrameOptions, frame.action || 'sameorigin');
      }
    }

    if (pcdp && typeof pcdp !== 'boolean') {
      res.setHeader(HeaderField.XPermittedCrossDomainPolicies, pcdp.policy || 'none');
    }

    if (xss) {
      res.setHeader(HeaderField.XXssProtection, '0');
    }

    if (oac) {
      res.setHeader(HeaderField.OriginAgentCluster, '?1');
    }

    if (corp && typeof corp !== 'boolean') {
      res.setHeader(HeaderField.CrossOriginResourcePolicy, corp.policy || 'same-origin');
    }

    if (coop && typeof coop !== 'boolean') {
      res.setHeader(HeaderField.CrossOriginOpenerPolicy, coop.policy || 'same-origin');
    }

    if (coep && typeof coep !== 'boolean') {
      res.setHeader(HeaderField.CrossOriginEmbedderPolicy, (coep as any).policy || 'require-corp');
    }

    if (ref) {
      const policy = Array.isArray(ref.policy) ? ref.policy.join(',') : (ref.policy || 'no-referrer');

      res.setHeader(HeaderField.ReferrerPolicy, policy);
    }

    if (options.expectCt) {
      const parts = [`max-age=${options.expectCt.maxAge ?? 0}`];

      if (options.expectCt.enforce) {
        parts.push('enforce');
      }

      if (options.expectCt.reportUri) {
        parts.push(`report-uri="${options.expectCt.reportUri}"`);
      }

      res.setHeader(HeaderField.ExpectCt, parts.join(', '));
    }

    if (hsts && typeof hsts !== 'boolean' && isHttps(req)) {
      const parts = [`max-age=${hsts.maxAge ?? 15552000}`];
      const include = hsts.includeSubDomains !== false;

      if (include) {
        parts.push('includeSubDomains');
      }

      const preload = !!hsts.preload;

      if (preload && !include) {
        parts.push('includeSubDomains');
      }

      if (preload) {
        parts.push('preload');
      }

      res.setHeader(HeaderField.StrictTransportSecurity, parts.join('; '));
    }

    if (pp && typeof pp.policy === 'string' && pp.policy.trim().length > 0) {
      res.setHeader(HeaderField.PermissionsPolicy, pp.policy.trim());
    }

    if (csp) {
      const defaultCsp = { 'default-src': "'self'", 'base-uri': "'self'", 'frame-ancestors': "'self'", 'object-src': "'none'", 'upgrade-insecure-requests': '' } as Record<string, string>;
      const user = csp.directives || {};
      const norm: Record<string, string | string[]> = {};

      Object.entries(user).forEach(([k, v]) => {
        norm[k.toLowerCase()] = v;
      });

      const merged = { ...defaultCsp, ...norm } as Record<string, string | string[]>;

      Object.keys(merged).forEach((k) => {
        const val = merged[k];

        if (typeof val === 'string' && val.trim() === '') {
          delete merged[k];
        }
      });

      const cspValue = toCsp(merged);

      if (cspValue) {
        res.setHeader(HeaderField.ContentSecurityPolicy, cspValue);
      }
    }

    const cspRoValue = toCsp(cspReportOnly?.directives);

    if (cspRoValue) {
      res.setHeader(HeaderField.ContentSecurityPolicyReportOnly, cspRoValue);
    }
  };
}

function isHttps(req: BunnerRequest) {
  const xfProto = req.headers?.get?.('x-forwarded-proto') || '';

  if (typeof xfProto === 'string' && xfProto.toLowerCase().includes(Protocol.Https)) {
    return true;
  }

  if (req.protocol === Protocol.Https) {
    return true;
  }

  return false;
}


function toCsp(d?: Record<string, string | string[]>) {
  if (!d) {
    return undefined;
  }

  return Object.entries(d).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(' ') : v}`).join('; ');
}
