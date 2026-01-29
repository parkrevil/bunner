import { describe, expect, it } from 'bun:test';

import { ModuleDiscovery } from './module-discovery';

describe('ModuleDiscovery', () => {
  it('should assign files to the closest module directory', () => {
    const files = [
      '/app/src/__module__.ts',
      '/app/src/a/__module__.ts',
      '/app/src/a/service.ts',
      '/app/src/a/sub/feature.ts',
      '/app/src/root.ts',
    ];

    const discovery = new ModuleDiscovery(files, '__module__.ts');
    const result = discovery.discover();

    const rootModuleFiles = result.get('/app/src/__module__.ts');
    const aModuleFiles = result.get('/app/src/a/__module__.ts');

    expect(rootModuleFiles ? Array.from(rootModuleFiles.values()).sort() : []).toEqual(['/app/src/root.ts']);
    expect(aModuleFiles ? Array.from(aModuleFiles.values()).sort() : []).toEqual([
      '/app/src/a/service.ts',
      '/app/src/a/sub/feature.ts',
    ]);
  });

  it('should track orphan files outside any module directory', () => {
    const files = ['/app/src/__module__.ts', '/app/other.ts'];

    const discovery = new ModuleDiscovery(files, '__module__.ts');
    discovery.discover();

    const orphans = Array.from(discovery.getOrphans().values());

    expect(orphans).toEqual(['/app/other.ts']);
  });
});