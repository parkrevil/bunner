import { relative, dirname, sep } from 'path';

export class PathResolver {
  /**
   * Calculates the relative path from the generated file to the source file.
   *
   * @param generatedFilePath The absolute path of the generated file (e.g. .bunner/manifest.ts)
   * @param sourceFilePath The absolute path of the source file (e.g. src/users/user.service.ts)
   */
  static getRelativeImportPath(generatedFilePath: string, sourceFilePath: string): string {
    const fromDir = dirname(generatedFilePath);
    let relativePath = relative(fromDir, sourceFilePath);

    // Ensure it starts with ./ or ../
    if (!relativePath.startsWith('.')) {
      relativePath = `./${relativePath}`;
    }

    // Remove extension (.ts, .js) for import
    return relativePath.replace(/\.(ts|js|tsx|jsx)$/, '');
    // Note: Bun supports .ts imports natively, but it's cleaner to be explicit or follow convention.
    // If we want to keep .ts extension (Bun style), we can remove the replacement.
    // Updated decision: Remove extension to be safe for now, or keep it if we are strict Bun.
    // Let's strip it to be standard.
  }

  /**
   * Normalizes path to be POSIX style (forward slashes) even on Windows,
   * though Bun/Mac is mostly POSIX.
   */
  static normalize(path: string): string {
    return path.split(sep).join('/');
  }
}
