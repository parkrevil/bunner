interface JsonObject {
  readonly [k: string]: JsonValue;
}

type JsonValue = null | boolean | number | string | ReadonlyArray<JsonValue> | JsonObject;

interface OxlintDiagnostic {
  readonly filePath?: string;
  readonly message: string;
  readonly code?: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly line?: number;
  readonly column?: number;
}

interface OxlintRunResult {
  readonly ok: boolean;
  readonly tool: 'oxlint';
  readonly exitCode?: number;
  readonly error?: string;
  readonly rawStdout?: string;
  readonly rawStderr?: string;
  readonly diagnostics?: ReadonlyArray<OxlintDiagnostic>;
}

interface RunOxlintInput {
  readonly targets: ReadonlyArray<string>;
  readonly configPath?: string;
}

const splitCommand = (value: string): string[] => value.split(/\s+/).filter(Boolean);

const asString = (value: JsonValue | undefined): string | undefined => (typeof value === 'string' ? value : undefined);

const asNumber = (value: JsonValue | undefined): number | undefined => (typeof value === 'number' ? value : undefined);

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isArray = (value: JsonValue | undefined): value is ReadonlyArray<JsonValue> => Array.isArray(value);

const getProp = (obj: JsonObject, key: string): JsonValue | undefined => obj[key];

const normalizeDiagnosticsFromJson = (value: JsonValue): ReadonlyArray<OxlintDiagnostic> => {
  if (!isObject(value) && !isArray(value)) {
    return [];
  }

  const diagnosticsProp = isObject(value) ? getProp(value, 'diagnostics') : undefined;
  const rawList: ReadonlyArray<JsonValue> = isArray(value) ? value : isArray(diagnosticsProp) ? diagnosticsProp : [];
  const out: OxlintDiagnostic[] = [];

  for (const item of rawList) {
    if (!isObject(item)) {
      continue;
    }

    const message = asString(getProp(item, 'message')) ?? asString(getProp(item, 'text')) ?? 'oxlint diagnostic';
    const code =
      asString(getProp(item, 'code')) ?? asString(getProp(item, 'ruleId')) ?? asString(getProp(item, 'rule'));
    const severityRaw = asString(getProp(item, 'severity')) ?? asString(getProp(item, 'level'));
    const severity: OxlintDiagnostic['severity'] =
      severityRaw === 'error' || severityRaw === 'warning' || severityRaw === 'info' ? severityRaw : 'warning';
    const filePath =
      asString(getProp(item, 'filePath')) ??
      asString(getProp(item, 'path')) ??
      asString(getProp(item, 'file')) ??
      asString(getProp(item, 'filename'));
    const line = asNumber(getProp(item, 'line')) ?? asNumber(getProp(item, 'row')) ?? asNumber(getProp(item, 'startLine'));
    const column =
      asNumber(getProp(item, 'column')) ?? asNumber(getProp(item, 'col')) ?? asNumber(getProp(item, 'startColumn'));
    const base: OxlintDiagnostic = { message, severity };
    const normalized: OxlintDiagnostic = {
      ...base,
      ...(filePath !== undefined ? { filePath } : {}),
      ...(code !== undefined ? { code } : {}),
      ...(line !== undefined ? { line } : {}),
      ...(column !== undefined ? { column } : {}),
    };

    out.push(normalized);
  }

  return out;
};

const runOxlint = async (input: RunOxlintInput): Promise<OxlintRunResult> => {
  const cmdRaw = (process.env.FIREBAT_OXLINT_CMD ?? '').trim();

  if (cmdRaw.length === 0) {
    return {
      ok: false,
      tool: 'oxlint',
      error: 'oxlint is not configured. Set FIREBAT_OXLINT_CMD (e.g. "bunx -y oxlint") to enable lint tool.',
    };
  }

  const cmd = splitCommand(cmdRaw);
  const args: string[] = [];

  if (input.configPath !== undefined && input.configPath.trim().length > 0) {
    args.push('--config', input.configPath);
  }

  // NOTE: oxlint JSON output flags may differ by version. For now, treat stdout/stderr as raw,
  // but if stdout is valid JSON, attempt best-effort normalization.
  args.push(...input.targets);

  const proc = Bun.spawn({
    cmd: [...cmd, ...args],
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'ignore',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    return { ok: false, tool: 'oxlint', exitCode, rawStdout: stdout, rawStderr: stderr, error: `oxlint exited with code ${exitCode}` };
  }

  const trimmed = stdout.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      const parsed = JSON.parse(trimmed) as JsonValue;
      const diagnostics = normalizeDiagnosticsFromJson(parsed);

      return { ok: true, tool: 'oxlint', exitCode, rawStdout: stdout, rawStderr: stderr, diagnostics };
    } catch {
      // fallthrough
    }
  }

  return { ok: true, tool: 'oxlint', exitCode, rawStdout: stdout, rawStderr: stderr, diagnostics: [] };
};

export { runOxlint };
export type { OxlintDiagnostic, OxlintRunResult, RunOxlintInput };
