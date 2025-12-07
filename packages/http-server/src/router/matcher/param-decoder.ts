import type { EncodedSlashBehavior } from '../types';
import { decodeURIComponentSafe } from '../utils/path-utils';

export interface ParamDecoderOptions {
  segments: string[];
  decodeParams: boolean;
  encodedSlashBehavior: EncodedSlashBehavior;
  decodeHints?: Uint8Array;
  failFastOnBadEncoding: boolean;
}

export class ParamDecoder {
  private readonly segments: string[];
  private readonly decodeParams: boolean;
  private readonly encodedSlashBehavior: EncodedSlashBehavior;
  private readonly decodeHints?: Uint8Array;
  private readonly failFastOnBadEncoding: boolean;
  private cache?: Array<string | undefined>;
  private suffixCache?: Array<string | undefined>;

  constructor(options: ParamDecoderOptions) {
    this.segments = options.segments;
    this.decodeParams = options.decodeParams;
    this.encodedSlashBehavior = options.encodedSlashBehavior;
    this.decodeHints = options.decodeHints;
    this.failFastOnBadEncoding = options.failFastOnBadEncoding;
  }

  get(index: number): string {
    const raw = this.segments[index]!;
    if (!this.decodeParams) {
      return raw;
    }
    const hints = this.decodeHints;
    if (!hints || hints[index] === 0) {
      return raw;
    }
    const cache = this.cache;
    if (cache && cache[index] !== undefined) {
      return cache[index];
    }
    const decoded = decodeURIComponentSafe(raw, this.encodedSlashBehavior, this.failFastOnBadEncoding);
    if (!this.cache) {
      this.cache = new Array<string | undefined>(this.segments.length);
    }
    this.cache[index] = decoded;
    return decoded;
  }

  getSuffix(startIndex: number): string {
    this.suffixCache ??= new Array<string | undefined>(this.segments.length + 1);
    if (startIndex >= this.segments.length) {
      this.suffixCache[startIndex] = '';
      return '';
    }
    const cached = this.suffixCache[startIndex];
    if (cached !== undefined) {
      return cached;
    }
    const remaining = this.segments.length - startIndex;
    const parts = new Array<string>(remaining);
    for (let i = 0; i < remaining; i++) {
      parts[i] = this.get(startIndex + i);
    }
    const value = parts.join('/');
    this.suffixCache[startIndex] = value;
    return value;
  }
}
