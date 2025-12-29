import { PathResolver, compareCodePoint } from '../common';

export class ImportRegistry {
  private imports = new Map<string, { path: string; alias: string; originalName: string }>();
  private aliases = new Set<string>();
  private fileClassMap = new Map<string, string>();

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

    let relativePath = filePath;

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
    const sorted = Array.from(this.imports.values()).sort((a, b) => {
      const pathDiff = compareCodePoint(a.path, b.path);

      if (pathDiff !== 0) {
        return pathDiff;
      }

      const nameDiff = compareCodePoint(a.originalName, b.originalName);

      if (nameDiff !== 0) {
        return nameDiff;
      }

      return compareCodePoint(a.alias, b.alias);
    });

    return sorted.map(info => {
      if (info.alias === info.originalName) {
        return `import { ${info.originalName} } from "${info.path}";`;
      }

      return `import { ${info.originalName} as ${info.alias} } from "${info.path}";`;
    });
  }
}
