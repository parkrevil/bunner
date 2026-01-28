import type { FirebatDetector, OutputFormat } from './types';

export interface FirebatCliOptions {
  readonly targets: readonly string[];
  readonly format: OutputFormat;
  readonly minTokens: number;
  readonly exitOnFindings: boolean;
  readonly detectors: ReadonlyArray<FirebatDetector>;
  readonly help: boolean;
}

export interface FirebatProgramConfig {
  readonly targets: readonly string[];
}
