import { PathResolver } from '../common';

export class ImportRegistry {
  private imports = new Map<string, { path: string; alias: string; originalName: string }>();
  private aliases = new Set<string>();
  private fileClassMap = new Map<string, string>(); // 'path::class' -> alias

  constructor(private outputDir: string) {}

  public getAlias(className: string, filePath: string): string {
    const key = `${filePath}::${className}`;
    if (this.fileClassMap.has(key)) {
      return this.fileClassMap.get(key)!;
    }

    let alias = className;
    let counter = 1;
    while (this.aliases.has(alias)) {
      alias = `${className}_${counter++}`;
    }

    this.aliases.add(alias);
    this.fileClassMap.set(key, alias);

    // Try to resolve package imports to absolute paths
    if (!filePath.startsWith('/') && !filePath.startsWith('\\') && !filePath.match(/^[a-zA-Z]:/)) {
      try {
        const resolved = Bun.resolveSync(filePath, process.cwd());
        filePath = resolved;
      } catch (_e) {
        // Prepare to ignore built-in modules or unresolvable paths
      }
    }

    // Determine import path
    let relativePath = filePath;

    // Handle Absolute Paths - Convert to Relative Path from Output Dir
    if (filePath.startsWith('/') || filePath.startsWith('\\') || filePath.match(/^[a-zA-Z]:/)) {
      relativePath = PathResolver.getRelativeImportPath(this.outputDir + '/dummy.ts', filePath);
    }

    this.imports.set(alias, { path: relativePath, alias, originalName: className });

    return alias;
  }

  public addImport(name: string, filePath: string): string {
    return this.getAlias(name, filePath);
  }

  public getImportStatements(): string[] {
    return Array.from(this.imports.values()).map(info => {
      if (info.alias === info.originalName) {
        return `import { ${info.originalName} } from "${info.path}";`;
      }
      return `import { ${info.originalName} as ${info.alias} } from "${info.path}";`;
    });
  }
}
