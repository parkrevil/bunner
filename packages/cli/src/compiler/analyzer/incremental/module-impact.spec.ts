import { describe, expect, it } from 'bun:test';

import type { ImportEntry } from '../interfaces';
import type { FileAnalysis } from '../graph/interfaces';

import { buildModuleImpact } from './module-impact';

const createFile = (filePath: string, importEntries: ImportEntry[] = []): FileAnalysis => {
  return {
    filePath,
    classes: [],
    reExports: [],
    exports: [],
    importEntries,
  };
};

const sorted = (values: Iterable<string>): string[] => Array.from(values).sort();

describe('buildModuleImpact', () => {
  it('returns empty sets when no files changed', () => {
    const aModule = '/app/src/a/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(aService, createFile(aService));

    const impact = buildModuleImpact(fileMap, 'module.ts', []);

    expect(sorted(impact.changedModules)).toEqual([]);
    expect(sorted(impact.affectedModules)).toEqual([]);
  });

  it('returns dependent modules when an imported module changes', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bService = '/app/src/b/b.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(bModule, createFile(bModule));
    fileMap.set(
      aService,
      createFile(aService, [
        { source: '../b/b.service', resolvedSource: bService, isRelative: true },
      ]),
    );
    fileMap.set(bService, createFile(bService));

    const impact = buildModuleImpact(fileMap, 'module.ts', [bService]);

    expect(sorted(impact.changedModules)).toEqual([bModule]);
    expect(sorted(impact.affectedModules)).toEqual([aModule, bModule]);
  });

  it('ignores dependencies that resolve outside the file map', () => {
    const aModule = '/app/src/a/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(
      aService,
      createFile(aService, [
        { source: './missing', resolvedSource: '/app/src/a/missing', isRelative: true },
      ]),
    );

    const impact = buildModuleImpact(fileMap, 'module.ts', [aService]);

    expect(sorted(impact.changedModules)).toEqual([aModule]);
    expect(sorted(impact.affectedModules)).toEqual([aModule]);
  });

  it('resolves extension-less imports against known files', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bService = '/app/src/b/b.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(bModule, createFile(bModule));
    fileMap.set(aService, createFile(aService, [
      { source: '../b/b.service', resolvedSource: '/app/src/b/b.service', isRelative: true },
    ]));
    fileMap.set(bService, createFile(bService));

    const impact = buildModuleImpact(fileMap, 'module.ts', [bService]);

    expect(sorted(impact.affectedModules)).toEqual([aModule, bModule]);
  });

  it('resolves index.ts when resolvedSource points to a directory', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bIndex = '/app/src/b/index.ts';
    const bService = '/app/src/b/b.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(bModule, createFile(bModule));
    fileMap.set(bIndex, createFile(bIndex, [
      { source: './b.service', resolvedSource: bService, isRelative: true },
    ]));
    fileMap.set(bService, createFile(bService));
    fileMap.set(aService, createFile(aService, [
      { source: '../b', resolvedSource: '/app/src/b', isRelative: true },
    ]));

    const impact = buildModuleImpact(fileMap, 'module.ts', [bService]);

    expect(sorted(impact.changedModules)).toEqual([bModule]);
    expect(sorted(impact.affectedModules)).toEqual([aModule, bModule]);
  });

  it('considers re-exports as dependencies (export * from)', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aEntry = '/app/src/a/entry.ts';
    const aApi = '/app/src/a/api.ts';
    const bService = '/app/src/b/b.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(bModule, createFile(bModule));
    fileMap.set(bService, createFile(bService));

    fileMap.set(aApi, {
      ...createFile(aApi),
      reExports: [{ module: bService, exportAll: true }],
    });

    fileMap.set(aEntry, createFile(aEntry, [
      { source: './api', resolvedSource: aApi, isRelative: true },
    ]));

    const impact = buildModuleImpact(fileMap, 'module.ts', [bService]);

    expect(sorted(impact.changedModules)).toEqual([bModule]);
    expect(sorted(impact.affectedModules)).toEqual([aModule, bModule]);
  });

  it('considers named re-exports as dependencies (export { x } from)', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aEntry = '/app/src/a/entry.ts';
    const aApi = '/app/src/a/api.ts';
    const bService = '/app/src/b/b.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(bModule, createFile(bModule));
    fileMap.set(bService, createFile(bService));

    fileMap.set(aApi, {
      ...createFile(aApi),
      reExports: [{ module: bService, exportAll: false, names: [{ local: 'bService', exported: 'foo' }] }],
    });

    fileMap.set(aEntry, createFile(aEntry, [
      { source: './api', resolvedSource: aApi, isRelative: true },
    ]));

    const impact = buildModuleImpact(fileMap, 'module.ts', [bService]);

    expect(sorted(impact.changedModules)).toEqual([bModule]);
    expect(sorted(impact.affectedModules)).toEqual([aModule, bModule]);
  });

  it('ignores non-relative imports even if resolvedSource looks like a file path', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bService = '/app/src/b/b.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(bModule, createFile(bModule));
    fileMap.set(bService, createFile(bService));

    fileMap.set(
      aService,
      createFile(aService, [
        { source: 'b.service', resolvedSource: bService, isRelative: false },
      ]),
    );

    const impact = buildModuleImpact(fileMap, 'module.ts', [bService]);

    expect(sorted(impact.changedModules)).toEqual([bModule]);
    expect(sorted(impact.affectedModules)).toEqual([bModule]);
  });

  it('does not blow up on cyclic file dependencies', () => {
    const aModule = '/app/src/a/module.ts';
    const a1 = '/app/src/a/a1.ts';
    const a2 = '/app/src/a/a2.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(a1, createFile(a1, [{ source: './a2', resolvedSource: a2, isRelative: true }]));
    fileMap.set(a2, createFile(a2, [{ source: './a1', resolvedSource: a1, isRelative: true }]));

    const impact = buildModuleImpact(fileMap, 'module.ts', [a1]);

    expect(sorted(impact.changedModules)).toEqual([aModule]);
    expect(sorted(impact.affectedModules)).toEqual([aModule]);
  });

  it('treats importEntries undefined as no dependencies', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bService = '/app/src/b/b.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(bModule, createFile(bModule));
    fileMap.set(aService, { ...createFile(aService), importEntries: undefined });
    fileMap.set(bService, createFile(bService));

    const impact = buildModuleImpact(fileMap, 'module.ts', [bService]);

    expect(sorted(impact.changedModules)).toEqual([bModule]);
    expect(sorted(impact.affectedModules)).toEqual([bModule]);
  });

  it('deduplicates duplicate changed files', () => {
    const aModule = '/app/src/a/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(aService, createFile(aService));

    const impact = buildModuleImpact(fileMap, 'module.ts', [aService, aService]);

    expect(sorted(impact.changedModules)).toEqual([aModule]);
    expect(sorted(impact.affectedModules)).toEqual([aModule]);
  });

  it('includes transitive dependents for deep changes', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const cModule = '/app/src/c/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bService = '/app/src/b/b.service.ts';
    const cService = '/app/src/c/c.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(bModule, createFile(bModule));
    fileMap.set(cModule, createFile(cModule));
    fileMap.set(
      aService,
      createFile(aService, [
        { source: '../b/b.service', resolvedSource: bService, isRelative: true },
      ]),
    );
    fileMap.set(
      bService,
      createFile(bService, [
        { source: '../c/c.service', resolvedSource: cService, isRelative: true },
      ]),
    );
    fileMap.set(cService, createFile(cService));

    const impact = buildModuleImpact(fileMap, 'module.ts', [cService]);

    expect(sorted(impact.changedModules)).toEqual([cModule]);
    expect(sorted(impact.affectedModules)).toEqual([aModule, bModule, cModule]);
  });

  it('includes the module root when the module file changes', () => {
    const aModule = '/app/src/a/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(aService, createFile(aService));

    const impact = buildModuleImpact(fileMap, 'module.ts', [aModule]);

    expect(sorted(impact.changedModules)).toEqual([aModule]);
    expect(sorted(impact.affectedModules)).toEqual([aModule]);
  });

  it('unions impacts across multiple changed modules', () => {
    const aModule = '/app/src/a/module.ts';
    const bModule = '/app/src/b/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const bService = '/app/src/b/b.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(bModule, createFile(bModule));
    fileMap.set(aService, createFile(aService));
    fileMap.set(bService, createFile(bService));

    const impact = buildModuleImpact(fileMap, 'module.ts', [aService, bService]);

    expect(sorted(impact.changedModules)).toEqual([aModule, bModule]);
    expect(sorted(impact.affectedModules)).toEqual([aModule, bModule]);
  });

  it('assigns files to the closest module when nested modules exist (regression)', () => {
    const rootModule = '/app/src/module.ts';
    const nestedModule = '/app/src/a/module.ts';
    const aService = '/app/src/a/a.service.ts';
    const rootService = '/app/src/root.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(rootModule, createFile(rootModule));
    fileMap.set(nestedModule, createFile(nestedModule));
    fileMap.set(aService, createFile(aService));
    fileMap.set(rootService, createFile(rootService));

    const impactA = buildModuleImpact(fileMap, 'module.ts', [aService]);
    const impactRoot = buildModuleImpact(fileMap, 'module.ts', [rootService]);

    expect(sorted(impactA.changedModules)).toEqual([nestedModule]);
    expect(sorted(impactRoot.changedModules)).toEqual([rootModule]);
  });

  it('does not confuse similar module directory names', () => {
    const modModule = '/app/src/mod/module.ts';
    const moduleModule = '/app/src/module/module.ts';
    const modService = '/app/src/mod/service.ts';
    const moduleService = '/app/src/module/service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(modModule, createFile(modModule));
    fileMap.set(moduleModule, createFile(moduleModule));
    fileMap.set(modService, createFile(modService));
    fileMap.set(moduleService, createFile(moduleService));

    const impact1 = buildModuleImpact(fileMap, 'module.ts', [modService]);
    const impact2 = buildModuleImpact(fileMap, 'module.ts', [moduleService]);

    expect(sorted(impact1.changedModules)).toEqual([modModule]);
    expect(sorted(impact2.changedModules)).toEqual([moduleModule]);
  });

  it('throws when no module roots exist (everything becomes orphan)', () => {
    const aFile = '/app/src/a.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aFile, createFile(aFile));

    expect(() => buildModuleImpact(fileMap, 'module.ts', [aFile])).toThrow(/Orphan files detected/);
  });

  it('throws when orphan files exist', () => {
    const aModule = '/app/src/a/module.ts';
    const orphan = '/app/src/orphan.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));
    fileMap.set(orphan, createFile(orphan));

    expect(() => buildModuleImpact(fileMap, 'module.ts', [orphan])).toThrow(
      /Orphan files detected/,
    );
  });

  it('throws when changed files are not in the file map', () => {
    const aModule = '/app/src/a/module.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(aModule, createFile(aModule));

    expect(() => buildModuleImpact(fileMap, 'module.ts', ['/app/src/a/missing.ts'])).toThrow(
      /Changed file not recognized/,
    );
  });
});