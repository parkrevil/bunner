import type { RouteKey } from '../../types';
import type { ImmutableRouterLayout, SerializedNodeRecord } from '../layout/immutable-router-layout';
import { matchStaticParts } from '../tree/tree-utils';

import { FrameStage, type MatchFrame } from './match-frame';

export interface StaticStageContext {
  segments: string[];
  nodes: ImmutableRouterLayout['nodes'];
  staticChildren: ImmutableRouterLayout['staticChildren'];
  segmentChains: ImmutableRouterLayout['segmentChains'];
  getParamCount: () => number;
}

export type StaticStageHandler = (frame: MatchFrame, stack: MatchFrame[]) => RouteKey | undefined;

export const createStaticStage = (context: StaticStageContext): StaticStageHandler => {
  return (frame, stack) => {
    const node = context.nodes[frame.nodeIndex]!;
    if (frame.segmentIndex >= context.segments.length || node.staticRangeCount === 0) {
      frame.stage = FrameStage.Params;
      return undefined;
    }
    const segment = context.segments[frame.segmentIndex]!;
    const childIndex = findStaticChild(node, segment, context.staticChildren);
    frame.stage = FrameStage.Params;
    if (childIndex === -1) {
      return undefined;
    }
    const child = context.nodes[childIndex]!;
    const parts = getSegmentParts(child, context.segmentChains);
    if (parts && parts.length > 1) {
      const matched = matchStaticParts(parts, context.segments, frame.segmentIndex);
      if (matched !== parts.length) {
        return undefined;
      }
      stack.push({
        nodeIndex: childIndex,
        segmentIndex: frame.segmentIndex + matched,
        stage: FrameStage.Enter,
        paramBase: context.getParamCount(),
        paramCursor: 0,
      });
      return undefined;
    }
    stack.push({
      nodeIndex: childIndex,
      segmentIndex: frame.segmentIndex + 1,
      stage: FrameStage.Enter,
      paramBase: context.getParamCount(),
      paramCursor: 0,
    });
    return undefined;
  };
};

const findStaticChild = (
  node: SerializedNodeRecord,
  segment: string,
  staticChildren: ImmutableRouterLayout['staticChildren'],
): number => {
  if (!node.staticRangeCount) {
    return -1;
  }
  let lo = node.staticRangeStart;
  let hi = lo + node.staticRangeCount - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const child = staticChildren[mid]!;
    if (child.segment === segment) {
      return child.target;
    }
    if (child.segment < segment) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return -1;
};

const getSegmentParts = (
  node: SerializedNodeRecord,
  segmentChains: ImmutableRouterLayout['segmentChains'],
): readonly string[] | null => {
  if (node.segmentPartsIndex === -1) {
    return null;
  }
  return segmentChains[node.segmentPartsIndex] ?? null;
};
