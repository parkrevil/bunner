import compressible from 'compressible';
import { StatusCodes } from 'http-status-codes';
import { brotliCompressSync as nodeBrotliCompressSync, constants as zlibConstants } from 'zlib';
import { ContentType, HeaderField } from '../../constants';
import type { Middleware } from '../../providers/middleware';
import { CompressAlgorithm, ETagAlgorithm } from './constants';
import type { AcceptCacheValue, CompressOptions } from './interfaces';
import type { BunDeflateLevel, BunGzipLevel, CompressAlgorithmValue, ETagAlgorithmValue, ZstdLevel } from './types';

const ACCEPT_CACHE = new Map<string, AcceptCacheValue>();
const ACCEPT_CACHE_MAX = 128;
const ACCEPT_CACHE_TTL_MS = 60_000;
let encoder: TextEncoder | undefined;

export function compress(options: CompressOptions = {}): Middleware {
  const algorithms = (options.negotiation?.algorithms ?? [CompressAlgorithm.Zstd, CompressAlgorithm.Gzip, CompressAlgorithm.Deflate, CompressAlgorithm.Brotli]) as CompressAlgorithmValue[];
  const thresholdBase = options.thresholds?.thresholdBytes ?? 1024;
  const minRatioBase = options.thresholds?.minRatio ?? 0.8;
  const smallStringBytes = options.thresholds?.smallStringBytes ?? 64;
  const preserveWeakETag = options.etag?.preserveWeak === true;
  const recomputeEtag = options.etag?.recompute === true;
  const etagAlg = options.etag?.algorithm ?? ETagAlgorithm.SHA256;
  const treatVendor = options.negotiation?.treatVendorJsonXmlAsCompressible ?? false;
  const filterCustom = options.types?.filter;
  const includeTypes = options.types?.includeTypes ?? [];
  const excludeTypes = options.types?.excludeTypes ?? [];

  const includeMatchers = buildMatchers(includeTypes.map((s) => (typeof s === 'string' ? s.toLowerCase() : s)));
  const excludeMatchers = buildMatchers(excludeTypes.map((s) => (typeof s === 'string' ? s.toLowerCase() : s)));

  const compressibleFilter = filterCustom ?? compressibleTypeFilter(treatVendor);
  const baseFilter = (ct?: string) => {
    const canon = canonicalizeContentType(ct);
    if (!compressibleFilter(canon)) return false;
    if (canon && includeMatchers.length > 0 && !matchesAny(canon, includeMatchers)) return false;
    if (canon && excludeMatchers.length > 0 && matchesAny(canon, excludeMatchers)) return false;
    return true;
  };

  return async (req, res) => {
    const body = res.getBody();

    if (body === undefined || body === null) {
      return;
    }

    const status = res.getStatus();

    if (status === StatusCodes.NO_CONTENT || status === StatusCodes.NOT_MODIFIED || status === StatusCodes.PARTIAL_CONTENT) {
      return;
    }

    if (req.headers.get(HeaderField.Range)) {
      return;
    }

    if (res.getHeader(HeaderField.ContentEncoding) || res.getHeader(HeaderField.NoCompress)) {
      return;
    }

    const cacheCtl = res.getHeader(HeaderField.CacheControl) || '';

    if (typeof cacheCtl === 'string' && cacheCtl.toLowerCase().includes('no-transform')) {
      return;
    }

    const disable = options.runtime?.disablePredicate;

    if (disable && disable(req.raw)) {
      return;
    }

    const contentType = (res.getContentType() as string | undefined) ?? inferTypeForCompression(body);

    if (!baseFilter(contentType)) {
      return;
    }

    let pick: CompressAlgorithmValue | undefined;
    const accept = req.headers.get(HeaderField.AcceptEncoding) || '';
    const acceptTrim = accept.trim().toLowerCase();

    if (!acceptTrim) {
      return;
    }

    const supported = parseAcceptCached(accept);
    const wildcard = supported.get('*') ?? 0;
    const identity = supported.get('identity') ?? 0;

    pick = algorithms
      .map((alg) => ({ alg, q: supported.get(alg) ?? wildcard }))
      .sort((a, b) => b.q - a.q)
      .find((e) => e.q > 0)?.alg;

    if (!pick) {
      return;
    }

    const chosenQ = supported.get(pick) ?? wildcard;

    if (identity && identity >= chosenQ) {
      return;
    }

    let input: Uint8Array | undefined;

    if (typeof body === 'string') {
      input = getTextEncoder().encode(body);
    } else if (body instanceof Uint8Array) {
      input = body;
    } else if (body instanceof ArrayBuffer) {
      input = new Uint8Array(body);
    } else if (body instanceof Blob) {
      input = new Uint8Array(await (body as Blob).arrayBuffer());
    } else {
      return;
    }

    const bytes = input.byteLength;

    if (bytes <= smallStringBytes) {
      return;
    }

    const dynamicThreshold = options.thresholds?.dynamicThreshold;
    const threshold = dynamicThreshold ? dynamicThreshold(bytes) : thresholdBase;

    if (bytes < threshold) {
      return;
    }

    let compressed: Uint8Array | undefined;

    if (pick === CompressAlgorithm.Zstd) {
      compressed = zstdCompress(input, options.quality?.zstdLevel ?? 3);
    } else if (pick === CompressAlgorithm.Brotli) {
      compressed = brotliCompress(input, options.quality?.brotliQuality ?? 6);
    } else if (pick === CompressAlgorithm.Gzip) {
      compressed = gzipCompress(input, options.quality?.gzipLevel ?? 6);
    } else if (pick === CompressAlgorithm.Deflate) {
      compressed = deflateCompress(input, options.quality?.deflateLevel ?? 6);
    }

    if (!compressed) {
      return;
    }

    const originalSize = bytes;
    const compressedSize = compressed.byteLength;
    const dynMinRatio = options.thresholds?.dynamicMinRatio;
    const minRatio = dynMinRatio ? dynMinRatio(originalSize) : minRatioBase;

    if (compressedSize / originalSize > minRatio) {
      return;
    }

    applyEncodingHeaders(res, pick, preserveWeakETag);

    res.setBody(compressed);

    if (!preserveWeakETag && recomputeEtag) {
      const tag = await hashETag(compressed, etagAlg);

      if (tag) {
        res.setHeader(HeaderField.ETag, tag);
      }
    }
  };
}

function getTextEncoder() {
  if (!encoder) {
    encoder = new TextEncoder();
  }

  return encoder;
}

function parseAcceptEncoding(header: string) {
  const map = new Map<string, number>();

  if (!header) {
    return map;
  }

  header.split(',').forEach((token) => {
    const [nameRaw, ...params] = token.split(';');
    const name = (nameRaw || '').trim().toLowerCase();

    if (!name) {
      return;
    }

    const qParam = params.find((p) => (p || '').trim().toLowerCase().startsWith('q='));
    const q = qParam ? qParam.split('=')[1] : undefined;
    const weight = q ? Number(q) : 1;

    if (Number.isFinite(weight)) {
      map.set(name, weight);
    }
  });

  return map;
}

function parseAcceptCached(header: string) {
  const key = canonicalizeAcceptHeader(header);
  const now = Date.now();
  const cached = ACCEPT_CACHE.get(key);

  if (cached && now - cached.ts <= ACCEPT_CACHE_TTL_MS) {
    ACCEPT_CACHE.delete(key);
    ACCEPT_CACHE.set(key, cached);

    return cached.value;
  }

  const value = parseAcceptEncoding(key);

  ACCEPT_CACHE.set(key, { value, ts: now });

  if (ACCEPT_CACHE.size > ACCEPT_CACHE_MAX) {
    const first = ACCEPT_CACHE.keys().next().value as string | undefined;

    if (first) {
      ACCEPT_CACHE.delete(first);
    }
  }

  return value;
}

function canonicalizeAcceptHeader(header: string) {
  return header
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(', ');
}

function toWeakEtag(etag: string) {
  const trimmed = etag.trim();

  return trimmed.startsWith('W/') ? trimmed : `W/${trimmed}`;
}

function canonicalizeContentType(contentType?: string) {
  if (!contentType) {
    return undefined;
  }

  const semi = contentType.indexOf(';');
  const lower = (semi >= 0 ? contentType.slice(0, semi) : contentType).trim().toLowerCase();

  return lower;
}

function compressibleTypeFilter(treatVendor?: boolean) {
  const cache = new Map<string, boolean>();
  return (ct?: string) => {
    if (!ct) {
      return false;
    }

    const lower = canonicalizeContentType(ct)!;

    if (cache.has(lower)) {
      return cache.get(lower)!;
    }
    let ok = !!compressible(lower);

    if (!ok && treatVendor) {
      if (lower.includes('+json') || lower.includes('+xml')) {
        ok = true;
      }
    }

    cache.set(lower, ok);

    return ok;
  };
}

function buildMatchers(patterns?: (string | RegExp)[]) {
  const fns: Array<(s: string) => boolean> = [];

  if (!patterns || patterns.length === 0) {
    return fns;
  }

  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i]!;

    if (typeof p === 'string') {
      const needle = p.toLowerCase();

      fns.push((s: string) => s.includes(needle));
    } else {
      fns.push((s: string) => p.test(s));
    }
  }

  return fns;
}

function matchesAny(value: string, matchers: Array<(s: string) => boolean>) {
  for (let i = 0; i < matchers.length; i++) {
    if (matchers[i]!(value)) {
      return true;
    }
  }

  return false;
}

async function hashETag(data: ArrayBuffer | Uint8Array, alg: ETagAlgorithmValue) {
  try {
    const view = data instanceof ArrayBuffer ? new Uint8Array(data) : (data as Uint8Array);

    if (!globalThis.crypto?.subtle) {
      return undefined;
    }

    const input = (view as unknown as BufferSource);
    const digest = await crypto.subtle.digest(alg, input);
    const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');

    return `"${hex}"`;
  } catch {
    return undefined;
  }
}

function inferTypeForCompression(body: any): string | undefined {
  if (typeof body === 'string') {
    return ContentType.Text;
  }

  if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
    return ContentType.OctetStream;
  }

  if (body instanceof Blob) {
    return body.type;
  }

  if (body !== null && (typeof body === 'object' || typeof body === 'number' || typeof body === 'boolean')) {
    return ContentType.Json;
  }

  return undefined;
}

function applyEncodingHeaders(res: any, encoding: string, preserveWeakETag: boolean) {
  if (preserveWeakETag) {
    const etag = res.getHeader(HeaderField.ETag);

    if (etag) {
      res.setHeader(HeaderField.ETag, toWeakEtag(etag));
    }
  }

  res
    .appendHeader(HeaderField.Vary, HeaderField.AcceptEncoding)
    .setHeader(HeaderField.ContentEncoding, encoding)
    .removeHeader(HeaderField.ContentLength);

  if (!preserveWeakETag) {
    res.removeHeader(HeaderField.ETag);
  }
}

function zstdCompress(input: Uint8Array, level: ZstdLevel): Uint8Array | undefined {
  return Bun.zstdCompressSync(input, { level });
}

function gzipCompress(input: Uint8Array, level: BunGzipLevel): Uint8Array | undefined {
  return Bun.gzipSync(input as Uint8Array<ArrayBuffer>, { level });
}

function deflateCompress(input: Uint8Array, level: BunDeflateLevel): Uint8Array | undefined {
  return Bun.deflateSync(input as Uint8Array<ArrayBuffer>, { level });
}

function brotliCompress(input: Uint8Array, quality: number | undefined): Uint8Array | undefined {
  try {
    const params: any = {};
    if (typeof zlibConstants?.BROTLI_PARAM_QUALITY !== 'undefined' && typeof quality === 'number') {
      params[zlibConstants.BROTLI_PARAM_QUALITY] = quality;
    }

    const out = nodeBrotliCompressSync(input, { params });

    return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
  } catch {
    return undefined;
  }
}
