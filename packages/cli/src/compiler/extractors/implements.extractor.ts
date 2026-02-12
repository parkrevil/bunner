import type { Program } from 'oxc-parser';
import type { CodeRelation, CodeRelationExtractor } from '../interfaces';
import { getQualifiedName, getSymbolEntityKey, buildImportMap, visit } from './utils';

export const ImplementsExtractor: CodeRelationExtractor = {
  name: 'implements',
  extract(ast: Program, filePath: string): CodeRelation[] {
    const relations: CodeRelation[] = [];
    const importMap = buildImportMap(ast, filePath);

    visit(ast, (node) => {
        if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
            if (node.implements && Array.isArray(node.implements)) {
                // @ts-ignore
                const className = node.id?.name;
                if (!className) return;
                const srcKey = getSymbolEntityKey(filePath, className);

                for (const impl of node.implements) {
                                        const name = getQualifiedName(impl.expression);
                                        if (!name) {
                                            continue;
                                        }

                                        // Identifier: IFace
                                        if (name.parts.length === 0) {
                                            const imported = importMap.get(name.root);
                                            if (imported) {
                                                relations.push({
                                                    type: 'implements',
                                                    srcEntityKey: srcKey,
                                                    dstEntityKey: getSymbolEntityKey(imported.path, imported.importedName),
                                                });
                                            } else {
                                                relations.push({
                                                    type: 'implements',
                                                    srcEntityKey: srcKey,
                                                    dstEntityKey: getSymbolEntityKey(filePath, name.root),
                                                    metaJson: JSON.stringify({ isLocal: true }),
                                                });
                                            }
                                            continue;
                                        }

                                        // MemberExpression: NS.IFace
                                        const importedNamespace = importMap.get(name.root);
                                        if (importedNamespace && importedNamespace.importedName === '*') {
                                            const last = name.parts[name.parts.length - 1];
                                            if (!last) {
                                                continue;
                                            }
                                            relations.push({
                                                type: 'implements',
                                                srcEntityKey: srcKey,
                                                dstEntityKey: getSymbolEntityKey(importedNamespace.path, last),
                                                metaJson: JSON.stringify({ isNamespaceImport: true }),
                                            });
                                            continue;
                                        }

                                        relations.push({
                                            type: 'implements',
                                            srcEntityKey: srcKey,
                                            dstEntityKey: getSymbolEntityKey(filePath, name.full),
                                            metaJson: JSON.stringify({ isLocal: true, isMember: true }),
                                        });
                }
            }
        }
    });

    return relations;
  }
};
