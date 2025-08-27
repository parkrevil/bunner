import type { BrotliQuality, BunDeflateLevel, BunGzipLevel, CompressAlgorithmValue, ETagAlgorithmValue, ZstdLevel } from './types';

export interface CompressOptions {
  negotiation?: {
    algorithms?: CompressAlgorithmValue[];
    treatVendorJsonXmlAsCompressible?: boolean;
  };
  thresholds?: {
    thresholdBytes?: number;
    dynamicThreshold?: (size: number) => number;
    minRatio?: number;
    dynamicMinRatio?: (size: number) => number;
    smallStringBytes?: number;
    sampleBytes?: number;
  };
  quality?: {
    gzipLevel?: BunGzipLevel;
    deflateLevel?: BunDeflateLevel;
    brotliQuality?: BrotliQuality;
    zstdLevel?: ZstdLevel;
  };
  types?: {
    filter?: (contentType?: string) => boolean;
    includeTypes?: Array<string | RegExp>;
    excludeTypes?: Array<string | RegExp>;
  };
  etag?: {
    preserveWeak?: boolean;
    recompute?: boolean;
    algorithm?: ETagAlgorithmValue;
  };
  runtime?: {
    disablePredicate?: (req: Request) => boolean;
  };
}

export interface AcceptCacheValue {
  value: Map<string, number>;
  ts: number;
}
