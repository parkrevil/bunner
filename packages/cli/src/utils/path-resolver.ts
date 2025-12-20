import { relative, dirname, sep } from 'path';

export class PathResolver {

  static getRelativeImportPath(generatedFilePath: string, sourceFilePath: string): string {
    const fromDir = dirname(generatedFilePath);
    let relativePath = relative(fromDir, sourceFilePath);

    if (!relativePath.startsWith('.')) {
      relativePath = `./${relativePath}`;
    }

    return relativePath.replace(/\.(ts|js|tsx|jsx)$/, '');

  }

  static normalize(path: string): string {
    return path.split(sep).join('/');
  }
}