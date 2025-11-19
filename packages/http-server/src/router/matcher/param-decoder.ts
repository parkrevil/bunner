import type { EncodedSlashBehavior } from '../types';
import { decodeURIComponentSafe } from '../utils/path-utils';

export interface ParamDecoderOptions {
  segments: string[];
  decodeParams: boolean;
  encodedSlashBehavior: EncodedSlashBehavior;
}

export class ParamDecoder {
  private readonly segments: string[];
  private readonly decodeParams: boolean;
  private readonly encodedSlashBehavior: EncodedSlashBehavior;
  private cache?: Array<string | undefined>;

  constructor(options: ParamDecoderOptions) {
    this.segments = options.segments;
    this.decodeParams = options.decodeParams;
    this.encodedSlashBehavior = options.encodedSlashBehavior;
  }

  get(index: number): string {
    if (!this.decodeParams) {
      return this.segments[index]!;
    }
    this.cache ??= new Array<string | undefined>(this.segments.length);
    const cached = this.cache[index];
    if (cached !== undefined) {
      return cached;
    }
    const value = decodeURIComponentSafe(this.segments[index]!, this.encodedSlashBehavior);
    this.cache[index] = value;
    return value;
  }
}
