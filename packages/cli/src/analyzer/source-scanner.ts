import { type ImportKind } from 'bun';

export interface DependencyNode {
  path: string;
  imports: {
    path: string;
    kind: ImportKind;
  }[];
  exports: string[];
}

export class SourceScanner {
  private transpiler = new Bun.Transpiler({ loader: 'ts' });

  async scanFile(filePath: string): Promise<DependencyNode | null> {
    try {
      const file = Bun.file(filePath);
      const code = await file.text();

      // Fast Scan using Bun Native
      const { imports, exports } = this.transpiler.scan(code);

      return {
        path: filePath,
        imports: imports.map(imp => ({
          path: imp.path,
          kind: imp.kind,
        })),
        exports: exports,
      };
    } catch (error) {
      console.error(`Failed to scan file: ${filePath}`, error);
      return null;
    }
  }

  async scanProject(_entryFile: string) {
    // TODO: Implement recursive scanning
    // For Phase 1, we just verify single file scanning works
    await Promise.resolve();
  }
}
