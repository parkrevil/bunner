import * as path from 'node:path';

import type { DuplicateGroup, FirebatReport, OutputFormat, ResourceWasteFinding } from './types';

const toPos = (line: number, column: number): string => `${line}:${column}`;

const formatDuplicateGroupText = (group: DuplicateGroup): string => {
  const lines: string[] = [];

  lines.push(`[duplicates] ${group.items.length} item(s)`);

  for (const item of group.items) {
    const rel = path.relative(process.cwd(), item.filePath);
    const start = toPos(item.span.start.line, item.span.start.column);

    lines.push(`  - ${item.kind}: ${item.header} @ ${rel}:${start} (tokens: ${item.tokens})`);
  }

  return lines.join('\n');
};

const formatWasteText = (finding: ResourceWasteFinding): string => {
  const rel = path.relative(process.cwd(), finding.filePath);
  const start = toPos(finding.span.start.line, finding.span.start.column);

  return `[waste] ${finding.kind}: ${finding.label} @ ${rel}:${start}`;
};

const formatText = (report: FirebatReport): string => {
  const lines: string[] = [];
  const detectors = report.meta.detectors.join(',');
  const duplicates = report.analyses.duplicates;
  const waste = report.analyses.waste;

  lines.push(
    `[firebat] engine=${report.meta.engine} version=${report.meta.version} detectors=${detectors} duplicates=${duplicates.length} waste=${waste.length}`,
  );

  for (const group of duplicates) {
    lines.push('');
    lines.push(formatDuplicateGroupText(group));
  }

  for (const finding of waste) {
    lines.push('');
    lines.push(formatWasteText(finding));
  }

  return lines.join('\n');
};

const formatReport = (report: FirebatReport, format: OutputFormat): string => {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }

  return formatText(report);
};

export { formatReport };
