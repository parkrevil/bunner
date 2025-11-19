export const enum FrameStage {
  Enter,
  Static,
  Params,
  Wildcard,
  Exit,
}

export type MatchFrame = {
  nodeIndex: number;
  segmentIndex: number;
  stage: FrameStage;
  paramBase: number;
  paramCursor: number;
  decodedSegment?: string;
};
