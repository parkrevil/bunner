import { dirname, sep } from 'path';

export class ModuleDiscovery {
  // Key: Absolute Path to __module__.ts (defines module identity)
  // Value: Set of file paths belonging to this module
  private moduleMap: Map<string, Set<string>> = new Map();
  private orphanFiles: Set<string> = new Set();

  constructor(private filePaths: string[]) {}

  public discover(): Map<string, Set<string>> {
    // 1. Find all module definitions
    const modules = this.filePaths.filter(p => p.endsWith('__module__.ts'));
    // Sort modules by path length descending to find "closest" (deepest) match first
    const sortedModules = modules.sort((a, b) => b.length - a.length);

    this.moduleMap.clear();
    this.orphanFiles.clear();
    modules.forEach(m => this.moduleMap.set(m, new Set()));

    // 2. Assign files to modules
    for (const file of this.filePaths) {
      if (file.endsWith('__module__.ts')) {
        continue; // Module ownership of itself is implicit or ignored
      }

      let assigned = false;
      const fileDir = dirname(file);

      // Find the closest module ancestor
      for (const modPath of sortedModules) {
        const modDir = dirname(modPath);

        // Check if file is inside modDir
        if (fileDir === modDir || fileDir.startsWith(modDir + sep)) {
          this.moduleMap.get(modPath)?.add(file);

          assigned = true;
          break; // Found the closest because we sorted by length desc
        }
      }

      if (!assigned) {
        this.orphanFiles.add(file);
      }
    }

    return this.moduleMap;
  }

  public getOrphans(): Set<string> {
    return this.orphanFiles;
  }
}
