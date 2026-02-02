export interface OxlintDiagnostic {
  readonly filePath?: string;
  readonly message: string;
  readonly code?: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly line?: number;
  readonly column?: number;
}

export interface OxlintRunResult {
  readonly ok: boolean;
  readonly tool: 'oxlint';
  readonly exitCode?: number;
  readonly error?: string;
  readonly rawStdout?: string;
  readonly rawStderr?: string;
  readonly diagnostics?: ReadonlyArray<OxlintDiagnostic>;
}

const splitCommand = (value: string): string[] => value.split(/\s+/).filter(Boolean);

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const asNumber = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);

const normalizeDiagnosticsFromJson = (value: unknown): ReadonlyArray<OxlintDiagnostic> => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const rawList: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray((value as any).diagnostics)
      ? ((value as any).diagnostics as unknown[])
      : [];

  const out: OxlintDiagnostic[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const message = asString((item as any).message) ?? asString((item as any).text) ?? 'oxlint diagnostic';
    const code = asString((item as any).code) ?? asString((item as any).ruleId) ?? asString((item as any).rule);
    const severityRaw = asString((item as any).severity) ?? asString((item as any).level);
    const severity: OxlintDiagnostic['severity'] =
      severityRaw === 'error' || severityRaw === 'warning' || severityRaw === 'info' ? severityRaw : 'warning';

    const filePath =
      asString((item as any).filePath) ??
      asString((item as any).path) ??
      asString((item as any).file) ??
      asString((item as any).filename);

    const line = asNumber((item as any).line) ?? asNumber((item as any).row) ?? asNumber((item as any).startLine);
    const column =
      asNumber((item as any).column) ?? asNumber((item as any).col) ?? asNumber((item as any).startColumn);

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

export const runOxlint = async (input: {
  targets: ReadonlyArray<string>;
  configPath?: string;
}): Promise<OxlintRunResult> => {
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

  if (input.configPath) {
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
      const parsed = JSON.parse(trimmed) as unknown;
      const diagnostics = normalizeDiagnosticsFromJson(parsed);
      return { ok: true, tool: 'oxlint', exitCode, rawStdout: stdout, rawStderr: stderr, diagnostics };
    } catch {
      // fallthrough
    }
  }

  return { ok: true, tool: 'oxlint', exitCode, rawStdout: stdout, rawStderr: stderr, diagnostics: [] };
};
