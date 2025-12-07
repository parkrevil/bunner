import type { EncodedSlashBehavior, SuffixPlan } from '../types';
import { decodeURIComponentSafe } from '../utils/path-utils';

import type { ParamDecoder } from './param-decoder';

interface WildcardSuffixCacheConfig {
  segments: string[];
  decodeParams: boolean;
  encodedSlashBehavior: EncodedSlashBehavior;
  plan?: SuffixPlan;
  planFactory?: () => SuffixPlan | undefined;
  paramDecoder?: ParamDecoder;
  failFastOnBadEncoding: boolean;
}

export class WildcardSuffixCache {
  private readonly segments: string[];
  private readonly decodeParams: boolean;
  private readonly encodedSlashBehavior: EncodedSlashBehavior;
  private planFactory?: () => SuffixPlan | undefined;
  private suffixCache?: Array<string | undefined>;
  private decodedSuffixCache?: Array<string | undefined>;
  private suffixOffsets?: Uint32Array;
  private suffixSource?: string;
  private paramDecoder?: ParamDecoder;
  private readonly failFastOnBadEncoding: boolean;

  constructor(config: WildcardSuffixCacheConfig) {
    this.segments = config.segments;
    this.decodeParams = config.decodeParams;
    this.encodedSlashBehavior = config.encodedSlashBehavior;
    this.planFactory = config.planFactory;
    this.paramDecoder = config.paramDecoder;
    this.failFastOnBadEncoding = config.failFastOnBadEncoding;
    if (config.plan) {
      this.applyPlan(config.plan);
      if (this.segments.length) {
        this.ensureSuffixCache();
      }
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
    if (!this.decodeParams) {
      return raw;
    }
    this.decodedSuffixCache ??= new Array<string | undefined>(this.segments.length + 1);
    const cached = this.decodedSuffixCache[index];
    if (cached !== undefined) {
      return cached;
    }
    let value: string;
    if (this.paramDecoder) {
      value = this.paramDecoder.getSuffix(index);
    } else {
      value = raw ? decodeURIComponentSafe(raw, this.encodedSlashBehavior, this.failFastOnBadEncoding) : '';
    }
    this.decodedSuffixCache[index] = value;
    return value;
  }

  setParamDecoder(decoder: ParamDecoder): void {
    this.paramDecoder = decoder;
  }

  private ensureSuffixCache(): void {
    if (!this.segments.length) {
      return;
    }
    if ((!this.suffixOffsets || !this.suffixSource) && this.planFactory) {
      const plan = this.planFactory();
      if (plan) {
        this.applyPlan(plan);
        this.planFactory = undefined;
      }
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

  private applyPlan(plan: SuffixPlan): void {
    this.suffixOffsets = plan.offsets;
    this.suffixSource = plan.source;
    if (plan.slices) {
      this.suffixCache = [...plan.slices];
    }
  }
}
