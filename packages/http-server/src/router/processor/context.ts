export interface ProcessorConfig {
  collapseSlashes?: boolean;
  ignoreTrailingSlash?: boolean;
  blockTraversal?: boolean;
  caseSensitive?: boolean;
  maxSegmentLength?: number;
  failFastOnBadEncoding?: boolean;
}

export class ProcessorContext {
  public path: string;
  public segments: string[] = [];
  public segmentDecodeHints?: Uint8Array;
  public readonly config: ProcessorConfig;

  constructor(path: string, config: ProcessorConfig) {
    this.path = path;
    this.config = config;
  }
}

export type PipelineStep = (ctx: ProcessorContext) => void;
