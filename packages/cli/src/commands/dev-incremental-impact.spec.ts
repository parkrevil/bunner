import { describe, expect, it } from 'bun:test';

import type { FileAnalysis } from '../analyzer/graph/interfaces';
import type { ImportEntry } from '../analyzer/interfaces';

import { buildDevIncrementalImpactLog } from './dev-incremental-impact';

const createFile = (filePath: string, importEntries: ImportEntry[] = []): FileAnalysis => {
  return {
    filePath,
    classes: [],
    reExports: [],
    exports: [],
    importEntries,
  };
};

const toRel = (path: string) => {
  return path.replace('/app/', '');
};

describe('buildDevIncrementalImpactLog', () => {
  it('prints changed/affected modules in a stable, sorted, project-relative format', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bService = '/app/src/b/b.service.ts';

    const previousFileMap = new Map<string, FileAnalysis>();

    previousFileMap.set(aModule, createFile(aModule));
    previousFileMap.set(bModule, createFile(bModule));
    previousFileMap.set(aService, createFile(aService, [
      { source: '../b/b.service', resolvedSource: bService, isRelative: true },
    ]));
    previousFileMap.set(bService, createFile(bService));

    const nextFileMap = new Map(previousFileMap.entries());

    const result = buildDevIncrementalImpactLog({
      previousFileMap,
      nextFileMap,
      moduleFileName: 'module.ts',
      changedFilePath: bService,
      isDeleted: false,
      toProjectRelativePath: toRel,
    });

    expect(result.impact).not.toBeNull();
    expect(result.logLine).toBe('🧭 증분 영향: 변경=src/b/module.ts | 영향=src/a/module.ts, src/b/module.ts');
  });

  it('uses previousFileMap when the file was deleted (rename + not exists)', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bService = '/app/src/b/b.service.ts';

    const previousFileMap = new Map<string, FileAnalysis>();

    previousFileMap.set(aModule, createFile(aModule));
    previousFileMap.set(bModule, createFile(bModule));
    previousFileMap.set(aService, createFile(aService, [
      { source: '../b/b.service', resolvedSource: bService, isRelative: true },
    ]));
    previousFileMap.set(bService, createFile(bService));

    const nextFileMap = new Map<string, FileAnalysis>();

    nextFileMap.set(aModule, createFile(aModule));
    nextFileMap.set(bModule, createFile(bModule));
    nextFileMap.set(aService, createFile(aService, [
      { source: '../b/b.service', resolvedSource: bService, isRelative: true },
    ]));

    const result = buildDevIncrementalImpactLog({
      previousFileMap,
      nextFileMap,
      moduleFileName: 'module.ts',
      changedFilePath: bService,
      isDeleted: true,
      toProjectRelativePath: toRel,
    });

    expect(result.impact).not.toBeNull();
    expect(result.logLine).toBe('🧭 증분 영향: 변경=src/b/module.ts | 영향=src/a/module.ts, src/b/module.ts');
  });

  it('returns a warning log line when buildModuleImpact throws (e.g., unrecognized changed file)', () => {
    const aModule = '/app/src/a/module.ts';
    const aService = '/app/src/a/a.service.ts';

    const previousFileMap = new Map<string, FileAnalysis>();

    previousFileMap.set(aModule, createFile(aModule));
    previousFileMap.set(aService, createFile(aService));

    const nextFileMap = new Map(previousFileMap.entries());

    const result = buildDevIncrementalImpactLog({
      previousFileMap,
      nextFileMap,
      moduleFileName: 'module.ts',
      changedFilePath: '/app/src/a/missing.ts',
      isDeleted: false,
      toProjectRelativePath: toRel,
    });

    expect(result.impact).toBeNull();
    expect(result.logLine.startsWith('⚠️ 증분 영향 계산 실패: ')).toBe(true);
    expect(result.logLine.includes('Changed file not recognized')).toBe(true);
  });

  it('sorts module paths after applying toProjectRelativePath (not before)', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bService = '/app/src/b/b.service.ts';

    const previousFileMap = new Map<string, FileAnalysis>();

    previousFileMap.set(aModule, createFile(aModule));
    previousFileMap.set(bModule, createFile(bModule));
    previousFileMap.set(aService, createFile(aService, [
      { source: '../b/b.service', resolvedSource: bService, isRelative: true },
    ]));
    previousFileMap.set(bService, createFile(bService));

    const nextFileMap = new Map(previousFileMap.entries());

    const flipSort = (path: string): string => {
      if (path === aModule) {
        return '2-a';
      }

      if (path === bModule) {
        return '1-b';
      }

      return toRel(path);
    };

    const result = buildDevIncrementalImpactLog({
      previousFileMap,
      nextFileMap,
      moduleFileName: 'module.ts',
      changedFilePath: bService,
      isDeleted: false,
      toProjectRelativePath: flipSort,
    });

    expect(result.impact).not.toBeNull();
    expect(result.logLine).toBe('🧭 증분 영향: 변경=1-b | 영향=1-b, 2-a');
  });

  it('does not downgrade to warning when toProjectRelativePath throws; it falls back per-path', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bService = '/app/src/b/b.service.ts';

    const previousFileMap = new Map<string, FileAnalysis>();

    previousFileMap.set(aModule, createFile(aModule));
    previousFileMap.set(bModule, createFile(bModule));
    previousFileMap.set(aService, createFile(aService, [
      { source: '../b/b.service', resolvedSource: bService, isRelative: true },
    ]));
    previousFileMap.set(bService, createFile(bService));

    const nextFileMap = new Map(previousFileMap.entries());

    const sometimesThrows = (path: string): string => {
      if (path === aModule) {
        throw new Error('boom');
      }

      if (path === bModule) {
        return 'B';
      }

      return toRel(path);
    };

    const result = buildDevIncrementalImpactLog({
      previousFileMap,
      nextFileMap,
      moduleFileName: 'module.ts',
      changedFilePath: bService,
      isDeleted: false,
      toProjectRelativePath: sometimesThrows,
    });

    expect(result.impact).not.toBeNull();
    expect(result.logLine.startsWith('🧭 증분 영향: ')).toBe(true);
    expect(result.logLine).toBe(`🧭 증분 영향: 변경=B | 영향=${aModule}, B`);
  });
});
