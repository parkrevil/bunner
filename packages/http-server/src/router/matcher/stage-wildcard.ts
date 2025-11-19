import type { RouteKey } from '../../types';
import type { ImmutableRouterLayout, SerializedNodeRecord } from '../layout/immutable-router-layout';

import { FrameStage, type MatchFrame } from './match-frame';
import type { WildcardSuffixCache } from './suffix-cache';

export interface WildcardStageContext {
  nodes: ImmutableRouterLayout['nodes'];
  segments: string[];
  suffixHelper?: WildcardSuffixCache;
  lookupMethodKey: (node: SerializedNodeRecord) => RouteKey | null;
  pushParam: (name: string, value: string) => void;
  setParamCount: (count: number) => void;
}

export type WildcardStageHandler = (frame: MatchFrame) => RouteKey | undefined;

export const createWildcardStage = (context: WildcardStageContext): WildcardStageHandler => {
  return frame => {
    const node = context.nodes[frame.nodeIndex]!;
    frame.stage = FrameStage.Exit;
    const wildcardIndex = node.wildcardChild;
    if (wildcardIndex === -1) {
      return undefined;
    }
    context.setParamCount(frame.paramBase);
    const wildcard = context.nodes[wildcardIndex]!;
    const key = context.lookupMethodKey(wildcard);
    if (key === null) {
      return undefined;
    }
    if (wildcard.wildcardOrigin === 'multi' && frame.segmentIndex >= context.segments.length) {
      return undefined;
    }
    const wildcardName = wildcard.segment || '*';
    const wildcardValue = context.suffixHelper?.getValue(frame.segmentIndex) ?? '';
    context.pushParam(wildcardName, wildcardValue);
    return key;
  };
};
