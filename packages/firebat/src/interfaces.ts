import type { FirebatDetector, MinSizeOption, OutputFormat } from './types';

export interface FirebatCliOptions {
  readonly targets: readonly string[];
  readonly format: OutputFormat;
  readonly minSize: MinSizeOption;
  readonly maxForwardDepth: number;
  readonly exitOnFindings: boolean;
  readonly detectors: ReadonlyArray<FirebatDetector>;
  readonly help: boolean;
}

export interface FirebatProgramConfig {
  readonly targets: readonly string[];
}
