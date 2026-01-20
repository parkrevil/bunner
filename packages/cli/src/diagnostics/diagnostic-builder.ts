import type { BuildDiagnosticParams, Diagnostic } from './types';

export function buildDiagnostic(params: BuildDiagnosticParams): Diagnostic {
  const { code, severity, summary, reason, file } = params;
  const summaryText = `[${severity}/${code}] ${summary} (${file})`;
  const whyText = `[${severity}/${code}] ${reason} (${file})`;
  const howTitle = `[${severity}/${code}] Fix ${code} in ${file}`;

  return {
    severity,
    code,
    summary: summaryText,
    why: whyText,
    where: [{ file }],
    how: [{ title: howTitle }],
  };
}
