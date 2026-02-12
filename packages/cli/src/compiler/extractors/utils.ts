import { relative, dirname, resolve, extname } from 'path';
import type { Program } from 'oxc-parser';

export function getModuleEntityKey(filePath: string): string {
  const relPath = relative(process.cwd(), filePath);
  return `module:${relPath}`;
}

export function getSymbolEntityKey(filePath: string, symbolName: string): string {
  const relPath = relative(process.cwd(), filePath);
  return `symbol:${relPath}#${symbolName}`;
}

/**
 * Best-effort resolution of relative imports to absolute paths.
 * Does NOT check file system. Assumes .ts if extension is missing.
 */
export function resolveRelativeImport(currentFilePath: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) {
    return null; // external or aliased
  }
  
  let resolved = resolve(dirname(currentFilePath), importPath);
  
  // Naive extension appending if missing
  if (!extname(resolved)) {
    resolved += '.ts';
  }
  
  return resolved;
}

export interface ImportReference {
  path: string;
  importedName: string;
}

export function buildImportMap(ast: Program, currentFilePath: string): Map<string, ImportReference> {
  const map = new Map<string, ImportReference>();
  
  for (const stmt of ast.body) {
      if (stmt.type === 'ImportDeclaration') {
        // @ts-ignore
        const source = stmt.source.value;
        const resolvedPath = resolveRelativeImport(currentFilePath, source);
        if (!resolvedPath) continue;

        // @ts-ignore
        const specifiers = stmt.specifiers;
        if (!specifiers) continue;

        for (const spec of specifiers) {
            // @ts-ignore
            const localName = spec.local.name;
            if (spec.type === 'ImportSpecifier') {
                 // @ts-ignore
                const importedName = spec.imported.name || spec.imported.value || localName;
                map.set(localName, { path: resolvedPath, importedName });
            } else if (spec.type === 'ImportDefaultSpecifier') {
                map.set(localName, { path: resolvedPath, importedName: 'default' });
            } else if (spec.type === 'ImportNamespaceSpecifier') {
                map.set(localName, { path: resolvedPath, importedName: '*' });
            }
        }
      }
  }
  return map;
}

export interface QualifiedName {
  root: string;
  parts: string[];
  full: string;
}

export function getQualifiedName(expr: any): QualifiedName | null {
  if (!expr || typeof expr !== 'object') {
    return null;
  }

  if (expr.type === 'Identifier' && typeof expr.name === 'string') {
    return { root: expr.name, parts: [], full: expr.name };
  }

  if (expr.type === 'ThisExpression') {
    return { root: 'this', parts: [], full: 'this' };
  }

  if (expr.type === 'Super') {
    return { root: 'super', parts: [], full: 'super' };
  }

  if (expr.type !== 'MemberExpression') {
    return null;
  }

  const parts: string[] = [];
  let cursor: any = expr;

  while (cursor && typeof cursor === 'object' && cursor.type === 'MemberExpression') {
    const property = cursor.property;

    if (!property || typeof property !== 'object') {
      return null;
    }

    if (property.type === 'Identifier' && typeof property.name === 'string') {
      parts.unshift(property.name);
    } else if (property.type === 'PrivateIdentifier' && typeof property.name === 'string') {
      parts.unshift(`#${property.name}`);
    } else {
      return null;
    }

    cursor = cursor.object;
  }

  if (!cursor || typeof cursor !== 'object') {
    return null;
  }

  const root =
    cursor.type === 'Identifier' && typeof cursor.name === 'string'
      ? cursor.name
      : cursor.type === 'ThisExpression'
        ? 'this'
        : cursor.type === 'Super'
          ? 'super'
          : null;

  if (!root) {
    return null;
  }

  return { root, parts, full: [root, ...parts].join('.') };
}

export function getStringLiteralValue(node: any): string | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  if (node.type === 'StringLiteral' && typeof node.value === 'string') {
    return node.value;
  }

  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  return null;
}

/**
 * Simple recursive AST visitor
 */
export function visit(node: any, callback: (node: any) => void) {
  if (!node || typeof node !== 'object') return;
  
  callback(node);

  for (const key in node) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'scope') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach(child => visit(child, callback));
    } else if (typeof value === 'object' && value !== null) {
      visit(value, callback);
    }
  }
}
