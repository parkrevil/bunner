import { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import { RouterNode } from './node';
import { matchStaticParts } from './tree-utils';
import type { DynamicMatchResult, DynamicMatcherConfig } from './types';
import { decodeURIComponentSafe } from './utils';

const enum FrameStage {
  Enter,
  Static,
  Params,
  Wildcard,
  Exit,
}

interface MatchFrame {
  node: RouterNode;
  idx: number;
  stage: FrameStage;
  paramBase: number;
  paramIndex: number;
  decoded?: string;
}

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
    const stack: MatchFrame[] = [{ node, idx, stage: FrameStage.Enter, paramBase: this.paramCount, paramIndex: 0 }];

    while (stack.length) {
      const frame = stack[stack.length - 1]!;
      switch (frame.stage) {
        case FrameStage.Enter: {
          if (frame.idx === this.segments.length) {
            const found = frame.node.methods.byMethod.get(this.method);
            if (found !== undefined) {
              return found;
            }
            frame.stage = FrameStage.Exit;
            continue;
          }
          frame.stage = FrameStage.Static;
          continue;
        }
        case FrameStage.Static: {
          if (frame.idx >= this.segments.length) {
            frame.stage = FrameStage.Params;
            continue;
          }
          const segment = this.segments[frame.idx]!;
          const child = frame.node.staticChildren.get(segment);
          frame.stage = FrameStage.Params;
          if (!child) {
            continue;
          }
          const parts = child.segmentParts;
          if (parts && parts.length > 1) {
            const matched = matchStaticParts(parts, this.segments, frame.idx);
            if (matched !== parts.length) {
              continue;
            }
            stack.push({
              node: child,
              idx: frame.idx + matched,
              stage: FrameStage.Enter,
              paramBase: this.paramCount,
              paramIndex: 0,
            });
            continue;
          }
          stack.push({
            node: child,
            idx: frame.idx + 1,
            stage: FrameStage.Enter,
            paramBase: this.paramCount,
            paramIndex: 0,
          });
          continue;
        }
        case FrameStage.Params: {
          const paramChildren = frame.node.paramChildren;
          if (!paramChildren.length || frame.idx >= this.segments.length) {
            frame.stage = FrameStage.Wildcard;
            frame.decoded = undefined;
            continue;
          }
          if (frame.paramIndex >= paramChildren.length) {
            frame.stage = FrameStage.Wildcard;
            frame.decoded = undefined;
            continue;
          }
          this.paramCount = frame.paramBase;
          frame.decoded ??= this.getDecodedSegment(frame.idx);
          const decoded = frame.decoded;
          const child = paramChildren[frame.paramIndex++]!;
          if (child.pattern && (!child.patternTester || !child.patternTester(decoded))) {
            continue;
          }
          this.pushParam(child.segment, decoded);
          stack.push({
            node: child,
            idx: frame.idx + 1,
            stage: FrameStage.Enter,
            paramBase: this.paramCount,
            paramIndex: 0,
          });
          continue;
        }
        case FrameStage.Wildcard: {
          frame.stage = FrameStage.Exit;
          const wildcard = frame.node.wildcardChild;
          if (!wildcard) {
            continue;
          }
          this.paramCount = frame.paramBase;
          const wildcardName = wildcard.segment || '*';
          const wildcardValue = this.getSuffixValue(frame.idx);
          const prev = this.paramCount;
          this.pushParam(wildcardName, wildcardValue);
          const key = wildcard.methods.byMethod.get(this.method);
          if (key !== undefined) {
            return key;
          }
          this.paramCount = prev;
          continue;
        }
        case FrameStage.Exit: {
          this.paramCount = frame.paramBase;
          stack.pop();
          continue;
        }
        default: {
          stack.pop();
          continue;
        }
      }
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
