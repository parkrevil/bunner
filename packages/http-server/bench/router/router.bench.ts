import { bench, group, run } from 'mitata';

import { HttpMethod } from '../../src/enums';
import type { RouterInstance } from '../../src/router/interfaces';
import { RadixRouterBuilder } from '../../src/router/router';
import type { RouteMatch, RouterOptions } from '../../src/router/types';

type RouteSpec = {
  pattern: string;
  sample: string;
};

type RunOptions = Parameters<typeof run>[0] & { filter?: RegExp };

const ALPHA_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const ALPHANUM_LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';
const NUMERIC_CHARS = '0123456789';
const HEX_CHARS = '0123456789abcdef';

const hasManualGc = typeof Bun.gc === 'function';
const exposedGlobalGc = (globalThis as { gc?: () => void }).gc;
let sinkPrimary = 0;
let sinkSecondary = 0;
let buildSequence = 0;

const HOT_PARAM_ITERATIONS = Math.max(1, Number(process.env.ROUTER_PARAM_WARM ?? '8'));

const staticRoutes1k = generateStaticRouteSpecs(1_000, 3, 8);
const staticRoutes10k = generateStaticRouteSpecs(10_000, 4, 8);
const staticRoutes100k = generateStaticRouteSpecs(100_000, 5, 8);
const deepStaticRoutes = generateStaticRouteSpecs(10_000, 8, 12);
const dynamicParamRoutes = generateDynamicRouteSpecs(12_000);

const static1kPatterns = toPatterns(staticRoutes1k);
const static10kPatterns = toPatterns(staticRoutes10k);
const static100kPatterns = toPatterns(staticRoutes100k);
const deepStaticPatterns = toPatterns(deepStaticRoutes);
const dynamicParamPatterns = toPatterns(dynamicParamRoutes);

const static1kSamples = toSamples(staticRoutes1k);
const static10kSamples = toSamples(staticRoutes10k);
const static100kSamples = toSamples(staticRoutes100k);
const deepStaticSamples = toSamples(deepStaticRoutes);
const dynamicParamSamples = toSamples(dynamicParamRoutes);

const httpMethods = Object.values(HttpMethod).filter((value): value is HttpMethod => typeof value === 'number');
const methodLabels = httpMethods.map(method => ({ method, label: HttpMethod[method] ?? `M${method}` }));

const benchFilterPattern = process.env.ROUTER_BENCH_FILTER;
const benchFormat = process.env.ROUTER_BENCH_FORMAT;
const benchUnits = process.env.ROUTER_BENCH_UNITS !== '0';
const benchGcEnabled = process.env.ROUTER_BENCH_GC !== '0';

const mitataOptions: RunOptions = {
  avg: true,
  min_max: true,
  percentiles: true,
  colors: process.env.NO_COLOR !== '1',
  units: benchUnits,
};

if (benchFilterPattern) {
  mitataOptions.filter = new RegExp(benchFilterPattern);
}

if (benchFormat === 'json') {
  mitataOptions.json = 2;
}

const routerStatic1k = buildRouter(static1kPatterns);
const routerStatic10k = buildRouter(static10kPatterns);
const routerStatic100k = buildRouter(static100kPatterns);
const routerDeepStatic = buildRouter(deepStaticPatterns);
const routerParamHeavy = buildRouter(dynamicParamPatterns);
const routerCaseInsensitive = buildRouter(static10kPatterns, { caseSensitive: false });
const routerCacheWarm = buildRouter(static10kPatterns, { enableCache: true, cacheSize: 4096 });
const routerCacheTiny = buildRouter(static10kPatterns, { enableCache: true, cacheSize: 1 });
const routerCacheSmall = buildRouter(static10kPatterns, { enableCache: true, cacheSize: 64 });
const routerCacheThrash = buildRouter([...static10kPatterns, '/cache/miss/:id{[0-9]{8}}'], {
  enableCache: true,
  cacheSize: 256,
});

const routerTrailingLoose = buildRouter(['/loose/path'], { ignoreTrailingSlash: true });
const routerTrailingStrict = buildRouter(['/strict/path/'], { ignoreTrailingSlash: false });
const routerCollapseSlash = buildRouter(['/collapse/slash/check'], { collapseSlashes: true });
const routerTraversalGuard = buildRouter(['/files/*path'], { blockTraversal: true });
const routerWildcard = buildRouter(['/wild/files/*rest']);
const routerOptional = buildRouter(['/optional/:id?/:sub?'], { collapseSlashes: true });
const routerMultiParam = buildRouter(['/multi/:slug+'], { collapseSlashes: false });
const routerDecodeOn = buildRouter(['/decode/:value'], { decodeParams: true });
const routerDecodeOff = buildRouter(['/decode/:value'], { decodeParams: false });
const routerRegexHeavy = buildRouter([
  '/checks/:tenant{[a-z0-9]{12}}/:workspace{[a-z0-9]{12}}/:application{[a-z0-9\\-]{10,20}}/:env{prod|stage|dev}',
]);
const routerTraversalLoose = buildRouter(['/files/*path'], { blockTraversal: false });
const routerCollapseLoose = buildRouter(['/collapse/slash/check'], { collapseSlashes: false });

const longSegmentSample = `/long/${'a'.repeat(1024)}/${'b'.repeat(1024)}`;
const unicodeSample = '/ユニコード/данные/😀/파일';
const malformedEncodedSamples = ['/encoded/%ZZ', '/encoded/foo%2'];
const segmentLimitBreachSample = `/limits/${'x'.repeat(512)}`;

const routerLongSegments = buildRouter([longSegmentSample]);
const routerUnicodeHeavy = buildRouter([unicodeSample]);
const routerMalformedDecode = buildRouter(['/encoded/:value'], { decodeParams: true });
const routerMalformedRaw = buildRouter(['/encoded/:value'], { decodeParams: false });
const routerFailFastDecode = buildRouter(['/encoded/:value'], { decodeParams: true, failFastOnBadEncoding: true });
const routerSegmentLimitTight = buildRouter(['/limits/:value'], { maxSegmentLength: 256 });

const routerMultiMethod = buildRouterFromEntries(static1kPatterns.map(path => ({ methods: httpMethods, path })));
const routerPriorityStaticParam = buildRouterFromEntries([
  { methods: HttpMethod.Get, path: '/priority/static' },
  { methods: HttpMethod.Get, path: '/priority/:id' },
]);
const routerPriorityWildcard = buildRouterFromEntries([{ methods: HttpMethod.Get, path: '/priority/*rest' }]);
const routerStarMethod = buildRouterFromEntries(static1kPatterns.map(path => ({ methods: '*', path })));

const static10kMissSamples = static10kSamples.map(sample => `${sample}-miss`);
const dynamicParamMissSamples = dynamicParamSamples.map(sample => `${sample}-404`);

// Warm cache-hit routers so subsequent benches measure steady-state behavior
consumeMatchResult(routerCacheWarm.match(HttpMethod.Get, static10kSamples[0]!));
for (let i = 0; i < 32; i++) {
  const sample = static10kSamples[i]!;
  consumeMatchResult(routerCacheTiny.match(HttpMethod.Get, sample));
  consumeMatchResult(routerCacheSmall.match(HttpMethod.Get, sample));
}

const roundStatic1k = makeRoundRobin(static1kSamples);
const roundStatic10k = makeRoundRobin(static10kSamples);
const roundStatic100k = makeRoundRobin(static100kSamples);
const roundDeepStatic = makeRoundRobin(deepStaticSamples);
const roundParamHeavy = makeRoundRobin(dynamicParamSamples);
const roundCaseInsensitive = makeRoundRobin(static10kSamples.map(p => p.toUpperCase()));
const roundCacheWarm = makeRoundRobin([static10kSamples[0]!]);
const roundLooseSlash = makeRoundRobin(['/loose/path/', '/loose/path///']);
const roundStrictSlash = makeRoundRobin(['/strict/path/']);
const roundCollapseSlash = makeRoundRobin(['/collapse////slash//check']);
const roundCollapseCanonical = makeRoundRobin(['/collapse/slash/check']);
const roundTraversal = makeRoundRobin(['/files/a/b/../c/./deep/file.txt', '/files/x/./y/../../z/asset.json']);
const roundTraversalDirect = makeRoundRobin(['/files/a/b/c/d.txt']);
const roundWildcard = makeRoundRobin(['/wild/files/a/b/c/d.txt', '/wild/files/a/b/c/d/e/f/archive.tar.gz']);
const roundOptionalMissing = makeRoundRobin(['/optional', '/optional/user-1']);
const roundMultiParam = makeRoundRobin(['/multi/alpha/beta/gamma/delta', '/multi/x/y/z']);
const roundDecodeEncoded = makeRoundRobin(['/decode/foo%2Fbar%2520baz', '/decode/a%2Bb%26c%20d']);
const roundRegexHeavy = makeRoundRobin([
  '/checks/d3adb33fd3ad/appspace01/app-alpha-tenant/env/dev',
  '/checks/feedfacebeef/workspace99/api-service-01/env/prod',
]);
const roundStaticMiss = makeRoundRobin(static10kMissSamples);
const roundParamMiss = makeRoundRobin(dynamicParamMissSamples);
const roundLongSegments = makeRoundRobin([longSegmentSample]);
const roundUnicodeHeavy = makeRoundRobin([unicodeSample]);
const roundMalformedEncoded = makeRoundRobin(malformedEncodedSamples);
const roundSegmentLimitBreach = makeRoundRobin([segmentLimitBreachSample]);
const roundMultiMethod = makeRoundRobin(static1kSamples);
const roundCacheMixed = makeRoundRobin(static10kSamples.slice(0, 32));
const roundPriorityStatic = makeRoundRobin(['/priority/static']);
const roundPriorityParam = makeRoundRobin(['/priority/abcd1234']);
const roundPriorityWildcard = makeRoundRobin(['/priority/a/b/c']);

let cacheMissCounter = 0;
const roundCacheMiss = (): string => {
  const next = cacheMissCounter++;
  const value = next.toString().padStart(8, '0');
  return `/cache/miss/${value}`;
};

group('build / registration', () => {
  bench('build: add 1k static routes', () => consumeBuildResult(buildRouter(static1kPatterns)));
  bench('build: add 10k static routes', () => consumeBuildResult(buildRouter(static10kPatterns)));
  bench('build: add 100k static routes', () => consumeBuildResult(buildRouter(static100kPatterns)));
  bench('build: add deep 10k static routes', () => consumeBuildResult(buildRouter(deepStaticPatterns)));
  bench('build: add 12k param-heavy routes', () => consumeBuildResult(buildRouter(dynamicParamPatterns)));
  bench('build: addAll multi-method 1k routes', () => {
    const router = new RadixRouterBuilder();
    const entries: Array<[HttpMethod, string]> = [];
    for (const path of static1kPatterns) {
      for (const method of httpMethods) {
        entries.push([method, path]);
      }
    }
    router.addAll(entries);
    return consumeBuildResult(router.build());
  });
  bench("build: add '*' multi-method 1k routes", () => {
    const router = new RadixRouterBuilder();
    for (const path of static1kPatterns) {
      router.add('*', path);
    }
    return consumeBuildResult(router.build());
  });
});

group('match / static fast-path', () => {
  bench('match: static 1k router', () => consumeMatchResult(routerStatic1k.match(HttpMethod.Get, roundStatic1k())));
  bench('match: static 10k router', () => consumeMatchResult(routerStatic10k.match(HttpMethod.Get, roundStatic10k())));
  bench('match: static 100k router', () => consumeMatchResult(routerStatic100k.match(HttpMethod.Get, roundStatic100k())));
  bench('match: deep segments 10k router', () => consumeMatchResult(routerDeepStatic.match(HttpMethod.Get, roundDeepStatic())));
});

group('match / normalization & options', () => {
  bench('match: case-insensitive fast-path', () =>
    consumeMatchResult(routerCaseInsensitive.match(HttpMethod.Get, roundCaseInsensitive())),
  );
  bench('match: ignoreTrailingSlash=true', () =>
    consumeMatchResult(routerTrailingLoose.match(HttpMethod.Get, roundLooseSlash())),
  );
  bench('match: ignoreTrailingSlash=false', () =>
    consumeMatchResult(routerTrailingStrict.match(HttpMethod.Get, roundStrictSlash())),
  );
  bench('match: collapseSlashes', () => consumeMatchResult(routerCollapseSlash.match(HttpMethod.Get, roundCollapseSlash())));
  bench('match: blockTraversal', () => consumeMatchResult(routerTraversalGuard.match(HttpMethod.Get, roundTraversal())));
  bench('match: collapseSlashes=false', () =>
    consumeMatchResult(routerCollapseLoose.match(HttpMethod.Get, roundCollapseCanonical())),
  );
  bench('match: blockTraversal=false', () =>
    consumeMatchResult(routerTraversalLoose.match(HttpMethod.Get, roundTraversalDirect())),
  );
});

// Optional competitor benchmarks (find-my-way, trouter). Enable with ROUTER_COMPARE=1
if (process.env.ROUTER_COMPARE === '1') {
  type Competitor = {
    name: string;
    buildStatic: (paths: string[]) => unknown;
    buildParamHeavy: (paths: string[]) => unknown;
    match: (router: any, method: string, path: string) => boolean;
  };

  const competitors: Competitor[] = [];

  try {
    // find-my-way

    const createFmw = (require as any)?.('find-my-way') ?? (await import('find-my-way')).default;
    const fmwAdapter: Competitor = {
      name: 'find-my-way',
      buildStatic(paths) {
        const r = createFmw({ ignoreTrailingSlash: false });
        for (const p of paths) {
          r.on('GET', p, () => {});
        }
        return r;
      },
      buildParamHeavy(paths) {
        const r = createFmw({ ignoreTrailingSlash: false });
        for (const p of paths) {
          r.on('GET', p, () => {});
        }
        return r;
      },
      match(r, method, path) {
        return !!r.find(method, path);
      },
    };
    competitors.push(fmwAdapter);
  } catch {}

  try {
    // trouter
    const { default: Trouter } = await import('trouter');
    const trouterAdapter: Competitor = {
      name: 'trouter',
      buildStatic(paths) {
        const r = new (Trouter as any)();
        for (const p of paths) {
          r.add('GET', p, 1);
        }
        return r;
      },
      buildParamHeavy(paths) {
        const r = new (Trouter as any)();
        for (const p of paths) {
          r.add('GET', p, 1);
        }
        return r;
      },
      match(r, method, path) {
        const m = r.find(method, path);
        return !!(m && m.handlers && m.handlers.length);
      },
    };
    competitors.push(trouterAdapter);
  } catch {}

  if (competitors.length) {
    for (const c of competitors) {
      const cStatic = c.buildStatic(static10kPatterns);
      const cParam = c.buildParamHeavy(dynamicParamPatterns);

      group(`competitors / ${c.name}`, () => {
        bench('build: add 10k static routes', () => {
          return c.buildStatic(static10kPatterns);
        });
        bench('build: add 12k param-heavy routes', () => {
          return c.buildParamHeavy(dynamicParamPatterns);
        });
        bench('match: static 10k router', () => {
          return c.match(cStatic, 'GET', roundStatic10k());
        });
        bench('match: static 10k miss', () => {
          return c.match(cStatic, 'GET', makeRoundRobin(static10kMissSamples)());
        });
        bench('match: param-heavy', () => {
          return c.match(cParam, 'GET', roundParamHeavy());
        });
      });
    }
  }
}

group('match / method coverage & priority', () => {
  for (const { method, label } of methodLabels) {
    bench(`match: multi-method ${label}`, () => consumeMatchResult(routerMultiMethod.match(method, roundMultiMethod())));
  }
  bench("match: wildcard '*' registration", () =>
    consumeMatchResult(routerStarMethod.match(HttpMethod.Patch, roundMultiMethod())),
  );
  bench('match: priority static branch', () =>
    consumeMatchResult(routerPriorityStaticParam.match(HttpMethod.Get, roundPriorityStatic())),
  );
  bench('match: priority param branch', () =>
    consumeMatchResult(routerPriorityStaticParam.match(HttpMethod.Get, roundPriorityParam())),
  );
  bench('match: priority wildcard branch', () =>
    consumeMatchResult(routerPriorityWildcard.match(HttpMethod.Get, roundPriorityWildcard())),
  );
});

group('match / misses', () => {
  bench('match: static 10k miss', () => consumeMatchResult(routerStatic10k.match(HttpMethod.Get, roundStaticMiss())));
  bench('match: param-heavy miss', () => consumeMatchResult(routerParamHeavy.match(HttpMethod.Get, roundParamMiss())));
  bench(`match: param-heavy miss x${HOT_PARAM_ITERATIONS}`, () => {
    for (let i = 0; i < HOT_PARAM_ITERATIONS; i++) {
      consumeMatchResult(routerParamHeavy.match(HttpMethod.Get, roundParamMiss()));
    }
  });
});

group('match / cache behavior', () => {
  bench('match: cache warm hits', () => consumeMatchResult(routerCacheWarm.match(HttpMethod.Get, roundCacheWarm())));
  bench('match: cache size=1 mixed', () => consumeMatchResult(routerCacheTiny.match(HttpMethod.Get, roundCacheMixed())));
  bench('match: cache size=64 mixed', () => consumeMatchResult(routerCacheSmall.match(HttpMethod.Get, roundCacheMixed())));
  bench('match: cache thrash misses', () => consumeMatchResult(routerCacheThrash.match(HttpMethod.Get, roundCacheMiss())));
});

group('match / params & wildcards', () => {
  bench('match: param heavy (regex + multi)', () =>
    consumeMatchResult(routerParamHeavy.match(HttpMethod.Get, roundParamHeavy())),
  );
  bench(`match: param heavy hot x${HOT_PARAM_ITERATIONS}`, () => {
    for (let i = 0; i < HOT_PARAM_ITERATIONS; i++) {
      consumeMatchResult(routerParamHeavy.match(HttpMethod.Get, roundParamHeavy()));
    }
  });
  bench('match: wildcard capture', () => consumeMatchResult(routerWildcard.match(HttpMethod.Get, roundWildcard())));
  bench('match: optional params', () => consumeMatchResult(routerOptional.match(HttpMethod.Get, roundOptionalMissing())));
  bench('match: multi-segment + params', () => consumeMatchResult(routerMultiParam.match(HttpMethod.Get, roundMultiParam())));
  bench('match: decodeParams=true', () => consumeMatchResult(routerDecodeOn.match(HttpMethod.Get, roundDecodeEncoded())));
  bench('match: decodeParams=false', () => consumeMatchResult(routerDecodeOff.match(HttpMethod.Get, roundDecodeEncoded())));
  bench('match: regex-heavy route', () => consumeMatchResult(routerRegexHeavy.match(HttpMethod.Get, roundRegexHeavy())));
});

group('match / extremes', () => {
  bench('match: long segments (2KB)', () => consumeMatchResult(routerLongSegments.match(HttpMethod.Get, roundLongSegments())));
  bench('match: unicode-heavy path', () => consumeMatchResult(routerUnicodeHeavy.match(HttpMethod.Get, roundUnicodeHeavy())));
  bench('match: malformed encoded param (decode)', () =>
    consumeMatchResult(routerMalformedDecode.match(HttpMethod.Get, roundMalformedEncoded())),
  );
  bench('match: malformed encoded param (raw)', () =>
    consumeMatchResult(routerMalformedRaw.match(HttpMethod.Get, roundMalformedEncoded())),
  );
  bench('match: malformed encoded param (fail-fast)', () =>
    consumeMatchResultWithError(() => routerFailFastDecode.match(HttpMethod.Get, roundMalformedEncoded())),
  );
  bench('match: segment limit rejection (256)', () =>
    consumeMatchResultWithError(() => routerSegmentLimitTight.match(HttpMethod.Get, roundSegmentLimitBreach())),
  );
});

if (benchGcEnabled) {
  measureLayoutGc('layout-match/param-heavy', routerParamHeavy, dynamicParamSamples, 20000);
  measureLayoutGc('layout-match/static-10k', routerStatic10k, static10kSamples, 20000);
}

if (hasManualGc) {
  Bun.gc(true);
}

await run(mitataOptions);
flushSink();

function buildRouter(paths: string[], options?: Partial<RouterOptions>): RouterInstance {
  const router = new RadixRouterBuilder({ maxSegmentLength: 5000, ...options });
  for (const path of paths) {
    router.add(HttpMethod.Get, path);
  }
  return router.build();
}

type RouterEntry = { path: string; methods: HttpMethod | HttpMethod[] | '*' };

function buildRouterFromEntries(entries: RouterEntry[], options?: Partial<RouterOptions>): RouterInstance {
  const router = new RadixRouterBuilder(options);
  for (const entry of entries) {
    router.add(entry.methods, entry.path);
  }
  return router.build();
}

function generateStaticRouteSpecs(count: number, depth: number, segmentLength: number): RouteSpec[] {
  const specs: RouteSpec[] = new Array(count);
  const next = makeSeededGenerator(count + depth + segmentLength);
  for (let i = 0; i < count; i++) {
    const segments: string[] = new Array(depth);
    for (let d = 0; d < depth; d++) {
      segments[d] = generateToken(() => next(), segmentLength, ALPHANUM_LOWER, i + d * 13);
    }
    const path = `/${segments.join('/')}`;
    specs[i] = { pattern: path, sample: path };
  }
  return specs;
}

function generateDynamicRouteSpecs(count: number): RouteSpec[] {
  const specs: RouteSpec[] = new Array(count);
  const next = makeSeededGenerator(0xbeef);
  for (let i = 0; i < count; i++) {
    const variant = i % 6;
    const scenarioSlug = i.toString(36).padStart(4, '0');
    const prefix = `/bench/${scenarioSlug}`;
    switch (variant) {
      case 0: {
        const userId = generateToken(() => next(), 24, HEX_CHARS);
        const postId = generateToken(() => next(), 24, HEX_CHARS);
        specs[i] = {
          pattern: `${prefix}/api/v1/users/:userId{[0-9a-f]{24}}/posts/:postId{[0-9a-f]{24}}`,
          sample: `${prefix}/api/v1/users/${userId}/posts/${postId}`,
        };
        break;
      }
      case 1: {
        const tenant = generateToken(() => next(), 12, ALPHANUM_LOWER);
        const site = generateToken(() => next(), 10, ALPHANUM_LOWER);
        const env = `env${(i % 4) + 1}`;
        const branch = `feature-${generateToken(() => next(), 5, ALPHA_LOWER)}`;
        specs[i] = {
          pattern: `${prefix}/tenants/:tenant{[a-z0-9]{12}}/sites/:site{[a-z0-9]{10}}/env/:env{env[0-9]+}/branches/:branch{[a-z0-9\\-]+}`,
          sample: `${prefix}/tenants/${tenant}/sites/${site}/env/${env}/branches/${branch}`,
        };
        break;
      }
      case 2: {
        const lang = generateToken(() => next(), 2, ALPHA_LOWER);
        const termA = `term-${generateToken(() => next(), 6, ALPHANUM_LOWER)}`;
        const termB = `ref-${generateToken(() => next(), 6, ALPHANUM_LOWER)}`;
        specs[i] = {
          pattern: `${prefix}/search/:lang{[a-z]{2}}/:terms+`,
          sample: `${prefix}/search/${lang}/${termA}/${termB}`,
        };
        break;
      }
      case 3: {
        const bucket = generateToken(() => next(), 8, ALPHANUM_LOWER);
        const keyA = generateToken(() => next(), 6, ALPHANUM_LOWER);
        const keyB = generateToken(() => next(), 6, ALPHANUM_LOWER);
        const revision = generateToken(() => next(), 4, NUMERIC_CHARS);
        specs[i] = {
          pattern: `${prefix}/files/:bucket{[a-z0-9]{8}}/:key{[a-z0-9]{12}}/:revision{[0-9]{4}}`,
          sample: `${prefix}/files/${bucket}/${keyA}${keyB}/${revision}`,
        };
        break;
      }
      case 4: {
        const tenantShort = generateToken(() => next(), 10, ALPHANUM_LOWER);
        const project = generateToken(() => next(), 10, ALPHANUM_LOWER);
        const branch = `release-${generateToken(() => next(), 4, ALPHANUM_LOWER)}`;
        const sha = generateToken(() => next(), 40, HEX_CHARS);
        specs[i] = {
          pattern: `${prefix}/tenants/:tenantShort{[a-z0-9]{10}}/projects/:project{[a-z0-9]{10}}/branches/:branch{[a-z0-9\\-]+}/commits/:sha{[0-9a-f]{40}}`,
          sample: `${prefix}/tenants/${tenantShort}/projects/${project}/branches/${branch}/commits/${sha}`,
        };
        break;
      }
      default: {
        const region = generateToken(() => next(), 3, ALPHA_LOWER);
        const service = generateToken(() => next(), 6, ALPHA_LOWER);
        const tailA = generateToken(() => next(), 5, ALPHANUM_LOWER);
        const tailB = generateToken(() => next(), 5, ALPHANUM_LOWER);
        specs[i] = {
          pattern: `${prefix}/regions/:region{[a-z]{3}}/services/:service{[a-z]{6}}/:trail+`,
          sample: `${prefix}/regions/${region}/services/${service}/${tailA}/${tailB}`,
        };
        break;
      }
    }
  }
  return specs;
}

function makeSeededGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
}

function generateToken(next: () => number, length: number, alphabet: string, salt = 0): string {
  let token = '';
  let state = salt;
  for (let i = 0; i < length; i++) {
    state ^= next();
    const idx = state % alphabet.length;
    token += alphabet[idx]!;
  }
  return token;
}

function toPatterns(specs: RouteSpec[]): string[] {
  return specs.map(spec => spec.pattern);
}

function toSamples(specs: RouteSpec[]): string[] {
  return specs.map(spec => spec.sample);
}

function makeRoundRobin<T>(items: T[]): () => T {
  let index = 0;
  const size = items.length;
  return () => {
    const value = items[index]!;
    index = index + 1;
    if (index === size) {
      index = 0;
    }
    return value;
  };
}

function measureLayoutGc(
  label: string,
  router: RouterInstance,
  samples: string[],
  iterations: number,
  method: HttpMethod = HttpMethod.Get,
): void {
  const sampler = makeRoundRobin(samples);
  const runOptionalGc = (): void => {
    if (hasManualGc) {
      Bun.gc(true);
      return;
    }
    if (typeof exposedGlobalGc === 'function') {
      exposedGlobalGc();
    }
  };
  runOptionalGc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < iterations; i++) {
    consumeMatchResult(router.match(method, sampler()));
  }
  runOptionalGc();
  const after = process.memoryUsage().heapUsed;
  const deltaKb = (after - before) / 1024;
  const trend = deltaKb === 0 ? '±' : deltaKb > 0 ? '+' : '';
  console.log(`[router gc] ${label}: ${trend}${deltaKb.toFixed(2)} KB over ${iterations} matches`);
}

function consumeMatchResultWithError(run: () => RouteMatch | null): void {
  try {
    consumeMatchResult(run());
  } catch (error) {
    sinkPrimary ^= 0xdeadbeef;
    if (error instanceof Error) {
      sinkSecondary ^= error.message.length & 0xffff;
    } else {
      sinkSecondary ^= 0xffff;
    }
  }
}

function consumeMatchResult(result: RouteMatch | null): void {
  if (!result) {
    sinkPrimary ^= 0xffffffff;
    return;
  }
  sinkPrimary ^= Number(result.key) & 0xffff;
  sinkSecondary ^= Object.keys(result.params).length & 0xffff;
}

function consumeBuildResult(router: RouterInstance): RouterInstance {
  sinkPrimary ^= ++buildSequence & 0xffff;
  return router;
}

function flushSink(): void {
  if (sinkPrimary === 0 && sinkSecondary === 0) {
    return;
  }
  const sinkLine = `[router bench sink] primary=${sinkPrimary.toString(16)} secondary=${sinkSecondary.toString(16)}`;
  if (benchFormat === 'json') {
    console.error(sinkLine);
  } else {
    console.log(sinkLine);
  }
}
