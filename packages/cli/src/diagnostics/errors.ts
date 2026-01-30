import type { Diagnostic } from './types';

export class DiagnosticReportError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(diagnostic: Diagnostic) {
    super(diagnostic.summary);

    this.diagnostic = diagnostic;
  }
}
