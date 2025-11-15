import { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import { RouterNode } from './node';
import { matchStaticParts } from './tree-utils';
import type { DynamicMatchResult, DynamicMatcherConfig } from './types';
import { decodeURIComponentSafe } from './utils';

export class DynamicMatcher {
  private readonly method: HttpMethod;
  private readonly segments: string[];
  private readonly decodeParams: boolean;
  private readonly hasWildcardRoutes: boolean;
  private readonly captureSnapshot: boolean;

  private paramNames: string[] = [];
  private paramValues: string[] = [];
  private paramCount = 0;
  private decodedSegmentCache?: Array<string | undefined>;
  private suffixCache?: string[];
  private decodedSuffixCache?: Array<string | undefined>;

  constructor(config: DynamicMatcherConfig) {
    this.method = config.method;
    this.segments = config.segments;
    this.decodeParams = config.decodeParams;
    this.hasWildcardRoutes = config.hasWildcardRoutes;
    this.captureSnapshot = config.captureSnapshot;
  }

  match(root: RouterNode): DynamicMatchResult | null {
    const key = this.walk(root, 0);
    if (key === null) {
      return null;
    }
    if (!this.paramCount) {
      return { key, params: Object.create(null) };
    }
    const { params, snapshot } = this.buildParams();
    return { key, params, snapshot };
  }

  private walk(node: RouterNode, idx: number): RouteKey | null {
    if (idx === this.segments.length) {
      const found = node.methods.byMethod.get(this.method);
      return found === undefined ? null : found;
    }

    const segment = this.segments[idx]!;
    if (node.staticChildren.size) {
      const child = node.staticChildren.get(segment);
      if (child) {
        const parts = child.segmentParts;
        if (parts && parts.length > 1) {
          const matched = matchStaticParts(parts, this.segments, idx);
          if (matched === parts.length) {
            const key = this.walk(child, idx + matched);
            if (key !== null) {
              return key;
            }
          }
        } else {
          const key = this.walk(child, idx + 1);
          if (key !== null) {
            return key;
          }
        }
      }
    }

    if (node.paramChildren.length) {
      for (const child of node.paramChildren) {
        if (child.pattern) {
          continue;
        }
        const prev = this.paramCount;
        this.pushParam(child.segment, this.getDecodedSegment(idx));
        const key = this.walk(child, idx + 1);
        if (key !== null) {
          return key;
        }
        this.paramCount = prev;
      }
      for (const child of node.paramChildren) {
        if (!child.pattern || !child.patternTester!(segment)) {
          continue;
        }
        const prev = this.paramCount;
        this.pushParam(child.segment, this.getDecodedSegment(idx));
        const key = this.walk(child, idx + 1);
        if (key !== null) {
          return key;
        }
        this.paramCount = prev;
      }
    }

    if (node.wildcardChild) {
      const wildcardName = node.wildcardChild.segment || '*';
      const wildcardValue = this.getSuffixValue(idx);
      const prev = this.paramCount;
      this.pushParam(wildcardName, wildcardValue);
      const key = node.wildcardChild.methods.byMethod.get(this.method);
      if (key !== undefined) {
        return key;
      }
      this.paramCount = prev;
    }

    return null;
  }

  private pushParam(name: string, value: string): void {
    this.paramNames[this.paramCount] = name;
    this.paramValues[this.paramCount] = value;
    this.paramCount++;
  }

  private getDecodedSegment(index: number): string {
    if (!this.decodeParams) {
      return this.segments[index]!;
    }
    this.decodedSegmentCache ??= new Array<string | undefined>(this.segments.length);
    const cached = this.decodedSegmentCache[index];
    if (cached !== undefined) {
      return cached;
    }
    const value = decodeURIComponentSafe(this.segments[index]!);
    this.decodedSegmentCache[index] = value;
    return value;
  }

  private getSuffixValue(index: number): string {
    if (!this.hasWildcardRoutes) {
      return '';
    }
    this.ensureSuffixCache();
    const raw = (this.suffixCache && this.suffixCache[index]) || '';
    if (!this.decodeParams || !raw) {
      return raw;
    }
    this.decodedSuffixCache ??= new Array<string | undefined>(this.segments.length);
    const cached = this.decodedSuffixCache[index];
    if (cached !== undefined) {
      return cached;
    }
    const value = decodeURIComponentSafe(raw);
    this.decodedSuffixCache[index] = value;
    return value;
  }

  private ensureSuffixCache(): void {
    if (this.suffixCache || !this.hasWildcardRoutes || !this.segments.length) {
      return;
    }
    this.suffixCache = new Array(this.segments.length);
    let suffix = '';
    for (let i = this.segments.length - 1; i >= 0; i--) {
      suffix = suffix ? `${this.segments[i]!}/${suffix}` : this.segments[i]!;
      this.suffixCache[i] = suffix;
    }
  }

  private buildParams(): { params: Record<string, string>; snapshot?: Array<[string, string]> } {
    const bag = Object.create(null) as Record<string, string>;
    let snapshot: Array<[string, string]> | undefined;
    if (this.captureSnapshot) {
      snapshot = new Array(this.paramCount);
    }
    for (let i = 0; i < this.paramCount; i++) {
      const name = this.paramNames[i]!;
      const value = this.paramValues[i]!;
      bag[name] = value;
      if (snapshot) {
        snapshot[i] = [name, value];
      }
    }
    return { params: bag, snapshot };
  }
}
