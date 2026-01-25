export type ProcessEnvRecord = Record<string, string | undefined>;

export interface RunCaptureConfig {
  readonly cwd: string;
  readonly env: ProcessEnvRecord;
}
