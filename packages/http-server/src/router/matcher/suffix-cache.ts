import type { EncodedSlashBehavior, SuffixPlan } from '../types';
import { decodeURIComponentSafe } from '../utils/path-utils';

interface WildcardSuffixCacheConfig {
  segments: string[];
  decodeParams: boolean;
  encodedSlashBehavior: EncodedSlashBehavior;
  plan?: SuffixPlan;
}

export class WildcardSuffixCache {
  private readonly segments: string[];
  private readonly decodeParams: boolean;
  private readonly encodedSlashBehavior: EncodedSlashBehavior;
  private suffixCache?: Array<string | undefined>;
  private decodedSuffixCache?: Array<string | undefined>;
  private suffixOffsets?: Uint32Array;
  private suffixSource?: string;

  constructor(config: WildcardSuffixCacheConfig) {
    this.segments = config.segments;
    this.decodeParams = config.decodeParams;
    this.encodedSlashBehavior = config.encodedSlashBehavior;
    if (config.plan) {
      this.suffixOffsets = config.plan.offsets;
      this.suffixSource = config.plan.source;
    }
    if (this.segments.length && config.plan) {
      this.ensureSuffixCache();
    }
  }

  getValue(index: number): string {
    if (!this.segments.length) {
      return '';
    }
    this.ensureSuffixCache();
    if (!this.suffixCache || !this.suffixOffsets || !this.suffixSource) {
      return '';
    }
    if (index < 0 || index >= this.suffixOffsets.length) {
      return '';
    }
    let raw = this.suffixCache[index];
    if (raw === undefined) {
      raw = this.suffixSource.slice(this.suffixOffsets[index]);
      this.suffixCache[index] = raw;
    }
    if (!this.decodeParams || !raw) {
      return raw;
    }
    this.decodedSuffixCache ??= new Array<string | undefined>(this.segments.length + 1);
    const cached = this.decodedSuffixCache[index];
    if (cached !== undefined) {
      return cached;
    }
    const value = decodeURIComponentSafe(raw, this.encodedSlashBehavior);
    this.decodedSuffixCache[index] = value;
    return value;
  }

  private ensureSuffixCache(): void {
    if (!this.segments.length) {
      return;
    }
    this.suffixCache ??= new Array(this.segments.length + 1);
    if (!this.suffixOffsets) {
      this.suffixOffsets = new Uint32Array(this.segments.length + 1);
      let offset = 0;
      for (let i = 0; i < this.segments.length; i++) {
        this.suffixOffsets[i] = offset;
        offset += this.segments[i]!.length;
        if (i !== this.segments.length - 1) {
          offset++;
        }
      }
      this.suffixOffsets[this.segments.length] = offset;
    }
    if (!this.suffixSource) {
      this.suffixSource = this.segments.join('/');
    }
  }
}
