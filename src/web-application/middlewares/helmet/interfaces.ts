export interface CoepOptions {
  policy: 'require-corp' | 'unsafe-none' | 'credentialless';
}

export interface CoopOptions {
  policy: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
}

export interface CorpOptions {
  policy: 'same-origin' | 'same-site' | 'cross-origin';
}

export interface FrameguardOptions {
  action: 'deny' | 'sameorigin';
}

export interface HstsOptions {
  maxAge: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

export interface ExpectCtOptions {
  maxAge?: number;
  enforce?: boolean;
  reportUri?: string;
}

export interface PcdpOptions {
  policy: 'none' | 'master-only' | 'by-content-type' | 'all';
}

export interface ReferrerPolicyOptions {
  policy: string | string[];
}

export interface PermissionsPolicyOptions {
  policy: string;
}

export interface CspOptions {
  directives: Record<string, string | string[]>;
}
export interface HidePoweredByOptions {
  value?: string; // 기존 setTo
}

export interface DnsPrefetchControlOptions {
  value: boolean; // 기존 allow
}

export interface FrameguardOptions {
  action: 'deny' | 'sameorigin';
}

export interface CoepOptions {
  policy: 'require-corp' | 'unsafe-none' | 'credentialless';
}

export interface CoopOptions {
  policy: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
}

export interface CorpOptions {
  policy: 'same-origin' | 'same-site' | 'cross-origin';
}


export interface HelmetOptions {
  hidePoweredBy?: boolean | HidePoweredByOptions;
  noSniff?: boolean;
  ieNoOpen?: boolean;
  originAgentCluster?: boolean;
  xssFilter?: boolean;
  dnsPrefetchControl?: boolean | DnsPrefetchControlOptions;

  frameguard?: boolean | FrameguardOptions;
  crossOriginEmbedderPolicy?: boolean | CoepOptions;
  crossOriginOpenerPolicy?: boolean | CoopOptions;
  crossOriginResourcePolicy?: boolean | CorpOptions;

  hsts?: boolean | HstsOptions;
  expectCt?: boolean | ExpectCtOptions;
  permittedCrossDomainPolicies?: boolean | PcdpOptions;
  referrerPolicy?: boolean | ReferrerPolicyOptions;
  permissionsPolicy?: boolean | PermissionsPolicyOptions;

  contentSecurityPolicy?: boolean | CspOptions;
  contentSecurityPolicyReportOnly?: boolean | CspOptions;

  disableXfoIfCspPresent?: boolean;
}