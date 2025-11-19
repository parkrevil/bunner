import type { RouteKey } from '../../types';
import type { ImmutableRouterLayout } from '../layout/immutable-router-layout';
import { ROUTE_REGEX_TIMEOUT } from '../pattern/pattern-tester';
import type { MatchObserverHooks, PatternTesterFn } from '../types';

import { FrameStage, type MatchFrame } from './match-frame';
import type { ParamDecoder } from './param-decoder';

export interface ParamStageContext {
  nodes: ImmutableRouterLayout['nodes'];
  paramChildren: ImmutableRouterLayout['paramChildren'];
  paramOrders?: ReadonlyArray<Uint16Array | null>;
  observer?: MatchObserverHooks;
  patternTesters: ReadonlyArray<PatternTesterFn | undefined>;
  paramDecoder: ParamDecoder;
  segmentsLength: number;
  setParamCount: (count: number) => void;
  getParamCount: () => number;
  pushParam: (name: string, value: string) => void;
}

export type ParamStageHandler = (frame: MatchFrame, stack: MatchFrame[]) => RouteKey | undefined;

export const createParamStage = (context: ParamStageContext): ParamStageHandler => {
  return (frame, stack) => {
    const node = context.nodes[frame.nodeIndex]!;
    if (frame.segmentIndex >= context.segmentsLength || node.paramRangeCount === 0) {
      frame.stage = FrameStage.Wildcard;
      frame.decodedSegment = undefined;
      return undefined;
    }
    if (frame.paramCursor >= node.paramRangeCount) {
      frame.stage = FrameStage.Wildcard;
      frame.decodedSegment = undefined;
      return undefined;
    }
    context.setParamCount(frame.paramBase);
    frame.decodedSegment ??= context.paramDecoder.get(frame.segmentIndex);
    const decoded = frame.decodedSegment;
    const order = context.paramOrders ? context.paramOrders[frame.nodeIndex] : null;
    const orderedOffset = order ? order[frame.paramCursor] : frame.paramCursor;
    if (orderedOffset === undefined || orderedOffset >= node.paramRangeCount) {
      frame.stage = FrameStage.Wildcard;
      frame.decodedSegment = undefined;
      return undefined;
    }
    frame.paramCursor++;
    const edge = context.paramChildren[node.paramRangeStart + orderedOffset]!;
    const childIndex = edge.target;
    const child = context.nodes[childIndex]!;
    if (!testParamPattern(child.patternIndex, decoded, context.patternTesters)) {
      return undefined;
    }
    context.observer?.onParamBranch?.(frame.nodeIndex, orderedOffset);
    context.pushParam(child.segment, decoded);
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

const testParamPattern = (patternIndex: number, value: string, testers: ReadonlyArray<PatternTesterFn | undefined>): boolean => {
  if (patternIndex === -1) {
    return true;
  }
  const tester = testers[patternIndex];
  if (!tester) {
    return true;
  }
  try {
    return tester(value);
  } catch (error) {
    if (error && typeof error === 'object' && (error as Record<typeof ROUTE_REGEX_TIMEOUT, boolean>)[ROUTE_REGEX_TIMEOUT]) {
      throw error;
    }
    return false;
  }
};
