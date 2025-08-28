import { CompressionAlgorithm, ETagAlgorithm } from './constants';

export type CompressionAlgorithmValue = (typeof CompressionAlgorithm)[keyof typeof CompressionAlgorithm];

export type ETagAlgorithmValue = (typeof ETagAlgorithm)[keyof typeof ETagAlgorithm];

export type BunGzipLevel = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type BunDeflateLevel = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type BrotliQuality = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type ZstdLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21;
