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

interface DynamicMatcherHooks {
  onParamMatch?: (parent: RouterNode, child: RouterNode) => void;
}

export class DynamicMatcher {
  private readonly method: HttpMethod;
  private readonly segments: string[];
  private readonly decodeParams: boolean;
  private readonly hasWildcardRoutes: boolean;
  private readonly captureSnapshot: boolean;
  private readonly onParamMatch?: (parent: RouterNode, child: RouterNode) => void;

  private paramNames: string[] = [];
  private paramValues: string[] = [];
  private paramCount = 0;
  private decodedSegmentCache?: Array<string | undefined>;
  private suffixCache?: Array<string | undefined>;
  private decodedSuffixCache?: Array<string | undefined>;
  private suffixOffsets?: number[];
  private suffixSource?: string;

  constructor(config: DynamicMatcherConfig, hooks?: DynamicMatcherHooks) {
    this.method = config.method;
    this.segments = config.segments;
    this.decodeParams = config.decodeParams;
    this.hasWildcardRoutes = config.hasWildcardRoutes;
    this.captureSnapshot = config.captureSnapshot;
    this.suffixSource = config.suffixSource;
    this.onParamMatch = hooks?.onParamMatch;
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
          this.onParamMatch?.(frame.node, child);
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
          const key = wildcard.methods.byMethod.get(this.method);
          if (key === undefined) {
            continue;
          }
          const wildcardName = wildcard.segment || '*';
          const wildcardValue = this.getSuffixValue(frame.idx);
          this.pushParam(wildcardName, wildcardValue);
          return key;
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
    if (!this.suffixCache || !this.suffixOffsets || !this.suffixSource) {
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
    if (this.suffixOffsets || !this.hasWildcardRoutes || !this.segments.length) {
      return;
    }
    this.suffixCache = new Array(this.segments.length);
    this.suffixOffsets = new Array(this.segments.length);
    let offset = 0;
    for (let i = 0; i < this.segments.length; i++) {
      this.suffixOffsets[i] = offset;
      offset += this.segments[i]!.length;
      if (i !== this.segments.length - 1) {
        offset++;
      }
    }
    if (!this.suffixSource) {
      this.suffixSource = this.segments.join('/');
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
