import { compareCodePoint } from '../common';

import type { Diagnostic, DiagnosticSeverity, ReportDiagnosticsParams } from './types';

const severityOrder: DiagnosticSeverity[] = ['trace', 'debug', 'info', 'warning', 'error', 'fatal'];
const getSeverityIndex = (severity: DiagnosticSeverity): number => {
  const index = severityOrder.indexOf(severity);

  return index >= 0 ? index : severityOrder.length;
};
const sortDiagnostics = (diagnostics: Diagnostic[]): Diagnostic[] => {
  return diagnostics.slice().sort((left, right) => {
    const severityDiff = getSeverityIndex(left.severity) - getSeverityIndex(right.severity);

    if (severityDiff !== 0) {
      return severityDiff;
    }

    const codeDiff = compareCodePoint(left.code, right.code);

    if (codeDiff !== 0) {
      return codeDiff;
    }

    const summaryDiff = compareCodePoint(left.summary, right.summary);

    if (summaryDiff !== 0) {
      return summaryDiff;
    }

    const leftFile = left.where[0]?.file ?? '';
    const rightFile = right.where[0]?.file ?? '';

    return compareCodePoint(leftFile, rightFile);
  });
};

export function reportDiagnostics(params: ReportDiagnosticsParams): void {
  const sorted = sortDiagnostics(params.diagnostics);
  const payload = JSON.stringify(sorted, null, 2);

  console.error(payload);
}
