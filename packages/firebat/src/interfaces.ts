import type { FirebatDetector, MinTokensOption, OutputFormat } from './types';

export interface FirebatCliOptions {
  readonly targets: readonly string[];
  readonly format: OutputFormat;
  readonly minTokens: MinTokensOption;
  readonly exitOnFindings: boolean;
  readonly detectors: ReadonlyArray<FirebatDetector>;
  readonly help: boolean;
}

export interface FirebatProgramConfig {
  readonly targets: readonly string[];
}
