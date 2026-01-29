import * as path from 'node:path';

import type {
  ApiDriftGroup,
  CouplingHotspot,
  DependencyAnalysis,
  DependencyEdgeCutHint,
  DependencyFanStat,
  DuplicateGroup,
  EarlyReturnItem,
  FirebatReport,
  NestingItem,
  NoopFinding,
  OutputFormat,
  WasteFinding,
} from './types';

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

const formatDuplicateGroupTextWithLabel = (label: string, group: DuplicateGroup): string => {
  const lines: string[] = [];

  lines.push(`[${label}] ${group.items.length} item(s)`);

  for (const item of group.items) {
    const rel = path.relative(process.cwd(), item.filePath);
    const start = toPos(item.span.start.line, item.span.start.column);

    lines.push(`  - ${item.kind}: ${item.header} @ ${rel}:${start} (tokens: ${item.tokens})`);
  }

  return lines.join('\n');
};

const formatWasteText = (finding: WasteFinding): string => {
  const rel = path.relative(process.cwd(), finding.filePath);
  const start = toPos(finding.span.start.line, finding.span.start.column);

  return `[waste] ${finding.kind}: ${finding.label} @ ${rel}:${start}`;
};

const formatDependencyFanStatText = (stat: DependencyFanStat): string => `  - ${stat.module}: ${stat.count}`;

const formatDependencyEdgeCutHintText = (hint: DependencyEdgeCutHint): string => {
  const score = typeof hint.score === 'number' ? hint.score : 0;
  const reason = typeof hint.reason === 'string' ? hint.reason : '';

  if (reason.length > 0) {
    return `  - ${hint.from} -> ${hint.to} (score=${score}, reason=${reason})`;
  }

  return `  - ${hint.from} -> ${hint.to} (score=${score})`;
};

const formatDependenciesText = (analysis: DependencyAnalysis): string => {
  const lines: string[] = [];

  lines.push(
    `[dependencies] cycles=${analysis.cycles.length} fanInTop=${analysis.fanInTop.length} fanOutTop=${analysis.fanOutTop.length} edgeCutHints=${analysis.edgeCutHints.length}`,
  );

  if (analysis.cycles.length > 0) {
    lines.push('');
    lines.push('[dependencies] cycles');

    for (const cycle of analysis.cycles) {
      lines.push(`  - ${cycle.path.join(' -> ')}`);
    }
  }

  if (analysis.fanInTop.length > 0) {
    lines.push('');
    lines.push('[dependencies] fan-in top');

    for (const stat of analysis.fanInTop) {
      lines.push(formatDependencyFanStatText(stat));
    }
  }

  if (analysis.fanOutTop.length > 0) {
    lines.push('');
    lines.push('[dependencies] fan-out top');

    for (const stat of analysis.fanOutTop) {
      lines.push(formatDependencyFanStatText(stat));
    }
  }

  if (analysis.edgeCutHints.length > 0) {
    lines.push('');
    lines.push('[dependencies] edge cut hints');

    for (const hint of analysis.edgeCutHints) {
      lines.push(formatDependencyEdgeCutHintText(hint));
    }
  }

  return lines.join('\n');
};

const formatCouplingHotspotText = (hotspot: CouplingHotspot): string => {
  const signals = hotspot.signals.join(',');

  return `  - ${hotspot.module}: score=${hotspot.score} signals=${signals}`;
};

const formatCouplingText = (hotspots: ReadonlyArray<CouplingHotspot>): string => {
  const lines: string[] = [];

  lines.push(`[coupling] hotspots=${hotspots.length}`);

  if (hotspots.length === 0) {
    return lines.join('\n');
  }

  for (const hotspot of hotspots) {
    lines.push(formatCouplingHotspotText(hotspot));
  }

  return lines.join('\n');
};

const formatNestingItemText = (item: NestingItem): string => {
  const rel = path.relative(process.cwd(), item.filePath);
  const start = toPos(item.span.start.line, item.span.start.column);
  const suggestions = item.suggestions.join('; ');

  if (suggestions.length > 0) {
    return `  - ${item.header} @ ${rel}:${start} depth=${item.metrics.depth} decisionPoints=${item.metrics.decisionPoints} score=${item.score} suggestions=${suggestions}`;
  }

  return `  - ${item.header} @ ${rel}:${start} depth=${item.metrics.depth} decisionPoints=${item.metrics.decisionPoints} score=${item.score}`;
};

const formatEarlyReturnItemText = (item: EarlyReturnItem): string => {
  const rel = path.relative(process.cwd(), item.filePath);
  const start = toPos(item.span.start.line, item.span.start.column);
  const suggestions = item.suggestions.join('; ');
  const guard = item.metrics.hasGuardClauses ? 'true' : 'false';

  if (suggestions.length > 0) {
    return `  - ${item.header} @ ${rel}:${start} earlyReturns=${item.metrics.earlyReturnCount} guardClauses=${guard} score=${item.score} suggestions=${suggestions}`;
  }

  return `  - ${item.header} @ ${rel}:${start} earlyReturns=${item.metrics.earlyReturnCount} guardClauses=${guard} score=${item.score}`;
};

const formatNoopFindingText = (finding: NoopFinding): string => {
  const rel = path.relative(process.cwd(), finding.filePath);
  const start = toPos(finding.span.start.line, finding.span.start.column);

  return `  - ${finding.kind} @ ${rel}:${start} confidence=${finding.confidence} evidence=${finding.evidence}`;
};

const formatApiDriftGroupText = (group: ApiDriftGroup): string => {
  const shape = group.standardCandidate;
  const outliers = group.outliers.map(outlier => outlier.shape);
  const outlierSummary = outliers
    .map(outlier => `(${outlier.paramsCount},${outlier.optionalCount},${outlier.returnKind},${outlier.async ? 'async' : 'sync'})`)
    .join(' ');

  return `  - ${group.label}: standard=(${shape.paramsCount},${shape.optionalCount},${shape.returnKind},${shape.async ? 'async' : 'sync'}) outliers=${group.outliers.length}${outlierSummary.length > 0 ? ` ${outlierSummary}` : ''}`;
};

const formatText = (report: FirebatReport): string => {
  const lines: string[] = [];
  const detectors = report.meta.detectors.join(',');
  const duplicates = report.analyses.duplicates;
  const waste = report.analyses.waste;
  const selectedDetectors = new Set(report.meta.detectors);

  lines.push(
    `[firebat] engine=${report.meta.engine} version=${report.meta.version} detectors=${detectors} duplicates=${duplicates.length} waste=${waste.length}`,
  );

  if (selectedDetectors.has('dependencies')) {
    lines.push(
      `[dependencies] cycles=${report.analyses.dependencies.cycles.length} fanInTop=${report.analyses.dependencies.fanInTop.length} fanOutTop=${report.analyses.dependencies.fanOutTop.length} edgeCutHints=${report.analyses.dependencies.edgeCutHints.length}`,
    );
  }

  if (selectedDetectors.has('coupling')) {
    lines.push(`[coupling] hotspots=${report.analyses.coupling.hotspots.length}`);
  }

  if (selectedDetectors.has('duplication')) {
    lines.push(`[duplication] cloneClasses=${report.analyses.duplication.cloneClasses.length}`);
  }

  if (selectedDetectors.has('nesting')) {
    lines.push(`[nesting] items=${report.analyses.nesting.items.length}`);
  }

  if (selectedDetectors.has('early-return')) {
    lines.push(`[early-return] items=${report.analyses.earlyReturn.items.length}`);
  }

  if (selectedDetectors.has('noop')) {
    lines.push(`[noop] findings=${report.analyses.noop.findings.length}`);
  }

  if (selectedDetectors.has('api-drift')) {
    lines.push(`[api-drift] groups=${report.analyses.apiDrift.groups.length}`);
  }

  for (const group of duplicates) {
    lines.push('');
    lines.push(formatDuplicateGroupText(group));
  }

  for (const finding of waste) {
    lines.push('');
    lines.push(formatWasteText(finding));
  }

  if (selectedDetectors.has('dependencies')) {
    lines.push('');
    lines.push(formatDependenciesText(report.analyses.dependencies));
  }

  if (selectedDetectors.has('coupling')) {
    lines.push('');
    lines.push(formatCouplingText(report.analyses.coupling.hotspots));
  }

  if (selectedDetectors.has('duplication')) {
    const cloneClasses = report.analyses.duplication.cloneClasses;

    lines.push('');
    lines.push(`[duplication] cloneClasses=${cloneClasses.length}`);

    for (const group of cloneClasses) {
      lines.push('');
      lines.push(formatDuplicateGroupTextWithLabel('duplication', group));
    }
  }

  if (selectedDetectors.has('nesting')) {
    const items = report.analyses.nesting.items;

    lines.push('');
    lines.push(`[nesting] items=${items.length}`);

    for (const item of items) {
      lines.push(formatNestingItemText(item));
    }
  }

  if (selectedDetectors.has('early-return')) {
    const items = report.analyses.earlyReturn.items;

    lines.push('');
    lines.push(`[early-return] items=${items.length}`);

    for (const item of items) {
      lines.push(formatEarlyReturnItemText(item));
    }
  }

  if (selectedDetectors.has('noop')) {
    const findings = report.analyses.noop.findings;

    lines.push('');
    lines.push(`[noop] findings=${findings.length}`);

    for (const finding of findings) {
      lines.push(formatNoopFindingText(finding));
    }
  }

  if (selectedDetectors.has('api-drift')) {
    const groups = report.analyses.apiDrift.groups;

    lines.push('');
    lines.push(`[api-drift] groups=${groups.length}`);

    for (const group of groups) {
      lines.push(formatApiDriftGroupText(group));
    }
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
