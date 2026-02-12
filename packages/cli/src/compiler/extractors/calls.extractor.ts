import type { Program } from 'oxc-parser';
import type { CodeRelation, CodeRelationExtractor } from '../interfaces';
import { buildImportMap, getQualifiedName, getSymbolEntityKey } from './utils';

export const CallsExtractor: CodeRelationExtractor = {
  name: 'calls',
  extract(ast: Program, filePath: string): CodeRelation[] {
    const relations: CodeRelation[] = [];
    const importMap = buildImportMap(ast, filePath);
        const functionStack: string[] = [];
        const classStack: string[] = [];

        function currentSrcEntityKey(): string | null {
            const name = functionStack.length > 0 ? functionStack[functionStack.length - 1] : null;
            return name ? getSymbolEntityKey(filePath, name) : null;
        }

        function resolveCallee(expr: any): { dstEntityKey: string; meta?: Record<string, unknown> } | null {
            const name = getQualifiedName(expr);
            if (!name) {
                return null;
            }

            // Identifier call: foo()
            if (name.parts.length === 0) {
                const imported = importMap.get(name.root);
                if (imported) {
                    return {
                        dstEntityKey: getSymbolEntityKey(imported.path, imported.importedName),
                        meta: { resolution: 'import', callee: name.root },
                    };
                }

                return {
                    dstEntityKey: getSymbolEntityKey(filePath, name.root),
                    meta: { resolution: 'local', callee: name.root },
                };
            }

            // Member call: NS.util()
            const importedNamespace = importMap.get(name.root);
            if (importedNamespace && importedNamespace.importedName === '*') {
                const last = name.parts[name.parts.length - 1];
                return {
                    dstEntityKey: getSymbolEntityKey(importedNamespace.path, last),
                    meta: { resolution: 'namespace', callee: name.full },
                };
            }

            // Best-effort local member
            return {
                dstEntityKey: getSymbolEntityKey(filePath, name.full),
                meta: { resolution: 'local-member', callee: name.full },
            };
        }

        function withFunction(name: string, bodyNode: any, walkFn: (node: any) => void): void {
            functionStack.push(name);
            walkFn(bodyNode);
            functionStack.pop();
        }

        function walk(node: any): void {
            if (!node || typeof node !== 'object') {
                return;
            }

            if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
                const className = node.id?.name;
                if (typeof className === 'string' && className.length > 0) {
                    classStack.push(className);
                } else {
                    classStack.push('AnonymousClass');
                }

                walk(node.body);
                classStack.pop();
                return;
            }

            if (node.type === 'FunctionDeclaration') {
                const name = node.id?.name;
                if (typeof name === 'string' && name.length > 0) {
                    withFunction(name, node.body, walk);
                    return;
                }
            }

            if (node.type === 'VariableDeclarator') {
                const idName = node.id?.type === 'Identifier' ? node.id.name : null;
                const initType = node.init?.type;
                if (
                    typeof idName === 'string' &&
                    (initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression')
                ) {
                    withFunction(idName, node.init.body, walk);
                    return;
                }
            }

            if (node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') {
                const keyName = node.key?.type === 'Identifier' ? node.key.name : null;
                const methodValue = node.value;
                if (
                    typeof keyName === 'string' &&
                    methodValue &&
                    typeof methodValue === 'object' &&
                    (methodValue.type === 'FunctionExpression' || methodValue.type === 'ArrowFunctionExpression')
                ) {
                    const className = classStack.length > 0 ? classStack[classStack.length - 1] : 'UnknownClass';
                    withFunction(`${className}.${keyName}`, methodValue.body, walk);
                    return;
                }
            }

            const srcKey = currentSrcEntityKey();

            if (node.type === 'CallExpression' && srcKey) {
                const resolved = resolveCallee(node.callee);
                if (resolved) {
                    relations.push({
                        type: 'calls',
                        srcEntityKey: srcKey,
                        dstEntityKey: resolved.dstEntityKey,
                        metaJson: resolved.meta ? JSON.stringify(resolved.meta) : undefined,
                    });
                }
            }

            if (node.type === 'NewExpression' && srcKey) {
                const resolved = resolveCallee(node.callee);
                if (resolved) {
                    relations.push({
                        type: 'calls',
                        srcEntityKey: srcKey,
                        dstEntityKey: resolved.dstEntityKey,
                        metaJson: JSON.stringify({ ...(resolved.meta ?? {}), isNew: true }),
                    });
                }
            }

            for (const key in node) {
                if (key === 'loc' || key === 'start' || key === 'end' || key === 'scope') continue;
                const value = node[key];
                if (Array.isArray(value)) {
                    for (const child of value) {
                        walk(child);
                    }
                } else if (typeof value === 'object' && value !== null) {
                    walk(value);
                }
            }
        }

        walk(ast);
    return relations;
  }
};
