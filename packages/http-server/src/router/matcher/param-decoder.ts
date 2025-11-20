import type { EncodedSlashBehavior } from '../types';
import { decodeURIComponentSafe } from '../utils/path-utils';

export interface ParamDecoderOptions {
  segments: string[];
  decodeParams: boolean;
  encodedSlashBehavior: EncodedSlashBehavior;
  decodeHints?: Uint8Array;
}

export class ParamDecoder {
  private readonly segments: string[];
  private readonly decodeParams: boolean;
  private readonly encodedSlashBehavior: EncodedSlashBehavior;
  private readonly decodeHints?: Uint8Array;
  private cache?: Array<string | undefined>;

  constructor(options: ParamDecoderOptions) {
    this.segments = options.segments;
    this.decodeParams = options.decodeParams;
    this.encodedSlashBehavior = options.encodedSlashBehavior;
    this.decodeHints = options.decodeHints;
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
    const decoded = decodeURIComponentSafe(raw, this.encodedSlashBehavior);
    if (!this.cache) {
      this.cache = new Array<string | undefined>(this.segments.length);
    }
    this.cache[index] = decoded;
    return decoded;
  }
}
