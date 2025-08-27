export interface HelmetOptions {
  contentSecurityPolicy?: false | { directives?: Record<string, string | string[]> };
  contentSecurityPolicyReportOnly?: false | { directives?: Record<string, string | string[]> };
  crossOriginEmbedderPolicy?: boolean | { policy?: 'require-corp' | 'unsafe-none' | 'credentialless' };
  crossOriginOpenerPolicy?: boolean | { policy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none' };
  crossOriginResourcePolicy?: boolean | { policy?: 'same-origin' | 'same-site' | 'cross-origin' };
  dnsPrefetchControl?: boolean | { allow?: boolean };
  expectCt?: false | { maxAge?: number; enforce?: boolean; reportUri?: string };
  frameguard?: boolean | { action?: 'deny' | 'sameorigin' };
  hidePoweredBy?: boolean | { setTo?: string };
  hsts?: boolean | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean };
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean | { policy?: 'none' | 'master-only' | 'by-content-type' | 'all' };
  referrerPolicy?: false | { policy?: string | string[] };
  xssFilter?: boolean;
  permissionsPolicy?: false | { policy?: string };
  disableXfoIfCspPresent?: boolean;
}
