export type ProcessEnvRecord = Record<string, string | undefined>;

export interface RunOptions {
  readonly cwd?: string;
  readonly env?: ProcessEnvRecord;
}

export interface DocTemplateRule {
  readonly path: string;
  readonly label: string;
  readonly requiredSnippets: ReadonlyArray<string>;
}
