import { HeaderField } from '../../constants';
import type { Middleware } from '../../providers/middleware';
import type { BunnerRequest } from '../../request';
import type {
  CoepOptions,
  CoopOptions,
  CorpOptions,
  DnsPrefetchControlOptions,
  ExpectCtOptions,
  FrameguardOptions,
  HelmetOptions,
  HidePoweredByOptions,
  HstsOptions,
  PcdpOptions,
  PermissionsPolicyOptions,
  ReferrerPolicyOptions,
} from './interfaces';

function resolveObjectOption<T extends object>(opt: boolean | T | undefined, defaultObj: T): T | undefined {
  if (opt === false) {
    return undefined;
  }

  if (typeof opt === 'boolean') {
    return defaultObj;
  }

  return opt ?? defaultObj;
}

function buildHeader(parts: string[], delimiter = '; ') {
  return parts.join(delimiter);
}

function buildHsts(opt: HstsOptions) {
  const parts = [`max-age=${opt.maxAge}`];

  if (opt.includeSubDomains !== false) {
    parts.push('includeSubDomains');
  }

  if (opt.preload) {
    parts.push('preload');
  }

  return buildHeader(parts, '; ');
}

function buildExpectCt(opt: ExpectCtOptions) {
  const parts = [`max-age=${opt.maxAge ?? 0}`];

  if (opt.enforce) {
    parts.push('enforce');
  }

  if (opt.reportUri) {
    parts.push(`report-uri="${opt.reportUri}"`);
  }

  return buildHeader(parts, ', ');
}

function buildCsp(directives: Record<string, string | string[]>) {
  const normalized: Record<string, string | string[]> = {};

  Object.entries(directives).forEach(([k, v]) => {
    normalized[k.toLowerCase()] = v;
  });

  return Object.entries(normalized)
    .filter(([_, v]) => !(typeof v === 'string' && v.trim() === ''))
    .map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(' ') : v}`)
    .join('; ');
}

export function helmet(options: HelmetOptions = {}): Middleware {
  const pipeline: ((req: BunnerRequest, res: any) => void)[] = [];

  const noSniff = options.noSniff ?? true;
  const ieNoOpen = options.ieNoOpen ?? true;
  const xssFilter = options.xssFilter ?? true;
  const originAgentCluster = options.originAgentCluster ?? true;

  if (noSniff) {
    pipeline.push((req, res) => res.setHeader(HeaderField.XContentTypeOptions, 'nosniff'));
  }

  if (ieNoOpen) {
    pipeline.push((req, res) => res.setHeader(HeaderField.XDownloadOptions, 'noopen'));
  }

  if (xssFilter) {
    pipeline.push((req, res) => res.setHeader(HeaderField.XXssProtection, '0'));
  }

  if (originAgentCluster) {
    pipeline.push((req, res) => res.setHeader(HeaderField.OriginAgentCluster, '?1'));
  }

  const hidePoweredByOpt = resolveObjectOption<HidePoweredByOptions>(options.hidePoweredBy, {});

  if (hidePoweredByOpt) {
    pipeline.push((req, res) => res.removeHeader(HeaderField.XPoweredBy));

    if (hidePoweredByOpt.value) {
      pipeline.push((req, res) => res.setHeader(HeaderField.XPoweredBy, hidePoweredByOpt.value));
    }
  }

  const coep = resolveObjectOption<CoepOptions>(options.crossOriginEmbedderPolicy, { policy: 'require-corp' });
  const coop = resolveObjectOption<CoopOptions>(options.crossOriginOpenerPolicy, { policy: 'same-origin' });
  const corp = resolveObjectOption<CorpOptions>(options.crossOriginResourcePolicy, { policy: 'same-origin' });
  const frame = resolveObjectOption<FrameguardOptions>(options.frameguard, { action: 'sameorigin' });
  const dnsPrefetch = resolveObjectOption<DnsPrefetchControlOptions>(options.dnsPrefetchControl, { value: false });
  const pcdp = resolveObjectOption<PcdpOptions>(options.permittedCrossDomainPolicies, { policy: 'none' });
  const ref = resolveObjectOption<ReferrerPolicyOptions>(options.referrerPolicy, { policy: 'no-referrer' });
  const pp = resolveObjectOption<PermissionsPolicyOptions>(options.permissionsPolicy, { policy: '' });
  const expectCt = resolveObjectOption<ExpectCtOptions>(options.expectCt, {});
  const hstsOpt = resolveObjectOption<HstsOptions>(options.hsts, { maxAge: 15552000, includeSubDomains: true, preload: false });

  if (coep) {
    pipeline.push((req, res) => res.setHeader(HeaderField.CrossOriginEmbedderPolicy, coep.policy));
  }

  if (coop) {
    pipeline.push((req, res) => res.setHeader(HeaderField.CrossOriginOpenerPolicy, coop.policy));
  }

  if (corp) {
    pipeline.push((req, res) => res.setHeader(HeaderField.CrossOriginResourcePolicy, corp.policy));
  }

  if (frame) {
    pipeline.push((req, res) => {
      const hasFrameAncestors =
        options.contentSecurityPolicy &&
        typeof options.contentSecurityPolicy !== 'boolean' &&
        !!options.contentSecurityPolicy.directives?.['frame-ancestors'];

      if (!(options.disableXfoIfCspPresent && hasFrameAncestors)) {
        res.setHeader(HeaderField.XFrameOptions, frame.action);
      }
    });
  }

  if (dnsPrefetch) {
    pipeline.push((req, res) =>
      res.setHeader(HeaderField.XDnsPrefetchControl, dnsPrefetch.value ? 'on' : 'off')
    );
  }

  if (pcdp) {
    pipeline.push((req, res) => res.setHeader(HeaderField.XPermittedCrossDomainPolicies, pcdp.policy));
  }

  if (ref) {
    const policy = Array.isArray(ref.policy) ? ref.policy.join(',') : ref.policy;
    pipeline.push((req, res) => res.setHeader(HeaderField.ReferrerPolicy, policy));
  }

  if (pp && pp.policy.trim()) {
    pipeline.push((req, res) => res.setHeader(HeaderField.PermissionsPolicy, pp.policy));
  }

  if (expectCt) {
    pipeline.push((req, res) => res.setHeader(HeaderField.ExpectCt, buildExpectCt(expectCt)));
  }

  if (hstsOpt) {
    pipeline.push((req, res) => {
      req.isHttps() && res.setHeader(HeaderField.StrictTransportSecurity, buildHsts(hstsOpt));
    });
  }

  if (options.contentSecurityPolicy && typeof options.contentSecurityPolicy !== 'boolean') {
    const cspOpts = options.contentSecurityPolicy;
    const cspHeader = buildCsp(cspOpts.directives ?? {});

    if (cspHeader) {
      pipeline.push((req, res) =>
        res.setHeader(HeaderField.ContentSecurityPolicy, cspHeader)
      );
    }
  }

  if (options.contentSecurityPolicyReportOnly && typeof options.contentSecurityPolicyReportOnly !== 'boolean') {
    const cspRoOpts = options.contentSecurityPolicyReportOnly;
    const cspRoHeader = buildCsp(cspRoOpts.directives ?? {});

    if (cspRoHeader) {
      pipeline.push((req, res) =>
        res.setHeader(HeaderField.ContentSecurityPolicyReportOnly, cspRoHeader)
      );
    }
  }

  return (req, res) => {
    for (const fn of pipeline) {
      fn(req, res);
    }
  };
}
