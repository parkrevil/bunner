import type { FileAnalysis } from '../analyzer/graph/interfaces';

import { buildModuleImpact, type ModuleImpact } from '../analyzer/incremental/module-impact';

export interface DevIncrementalImpactLogParams {
  previousFileMap: Map<string, FileAnalysis>;
  nextFileMap: Map<string, FileAnalysis>;
  moduleFileName: string;
  changedFilePath: string;
  isDeleted: boolean;
  toProjectRelativePath: (path: string) => string;
}

export interface DevIncrementalImpactLogResult {
  impact: ModuleImpact | null;
  logLine: string;
}

const formatModuleList = (modules: Iterable<string>, toProjectRelativePath: (path: string) => string): string => {
  const rendered = Array.from(modules).map(path => {
    try {
      return toProjectRelativePath(path);
    } catch (_error) {
      return path;
    }
  });

  rendered.sort((a, b) => a.localeCompare(b));

  return rendered.length > 0 ? rendered.join(', ') : '(none)';
};

export function buildDevIncrementalImpactLog(params: DevIncrementalImpactLogParams): DevIncrementalImpactLogResult {
  const { previousFileMap, nextFileMap, moduleFileName, changedFilePath, isDeleted, toProjectRelativePath } = params;

  try {
    const impactFileMap = isDeleted ? previousFileMap : nextFileMap;
    const impact = buildModuleImpact(impactFileMap, moduleFileName, [changedFilePath]);
    const changedModules = formatModuleList(impact.changedModules, toProjectRelativePath);
    const affectedModules = formatModuleList(impact.affectedModules, toProjectRelativePath);

    return { impact, logLine: `🧭 증분 영향: 변경=${changedModules} | 영향=${affectedModules}` };
  } catch (error) {
    const rawReason = error instanceof Error ? error.message : 'Unknown impact error.';
    const reason = rawReason.replaceAll('\n', ' ').trim() || 'Unknown impact error.';

    return { impact: null, logLine: `⚠️ 증분 영향 계산 실패: ${reason}` };
  }
}
