import type { Program } from 'oxc-parser';
import type { CodeRelation, CodeRelationExtractor } from '../interfaces';
import { getQualifiedName, getSymbolEntityKey, buildImportMap, visit } from './utils';

export const ExtendsExtractor: CodeRelationExtractor = {
  name: 'extends',
  extract(ast: Program, filePath: string): CodeRelation[] {
    const relations: CodeRelation[] = [];
    const importMap = buildImportMap(ast, filePath);

    // Scan classes
    visit(ast, (node) => {
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
          if (node.superClass) {
              // srcKey
              // @ts-ignore
              const className = node.id?.name;
              if (!className) return; 
              
              const srcKey = getSymbolEntityKey(filePath, className);

              // dstKey
                            const superName = getQualifiedName(node.superClass);
                            if (!superName) {
                                return;
                            }

                            // Identifier: Foo
                            if (superName.parts.length === 0) {
                                const imported = importMap.get(superName.root);
                                if (imported) {
                                    relations.push({
                                        type: 'extends',
                                        srcEntityKey: srcKey,
                                        dstEntityKey: getSymbolEntityKey(imported.path, imported.importedName),
                                    });
                                } else {
                                    relations.push({
                                        type: 'extends',
                                        srcEntityKey: srcKey,
                                        dstEntityKey: getSymbolEntityKey(filePath, superName.root),
                                        metaJson: JSON.stringify({ isLocal: true }),
                                    });
                                }
                                return;
                            }

                            // MemberExpression: NS.Base or Foo.Bar
                            const importedNamespace = importMap.get(superName.root);
                            if (importedNamespace && importedNamespace.importedName === '*') {
                                const last = superName.parts[superName.parts.length - 1];
                                if (!last) {
                                    return;
                                }
                                relations.push({
                                    type: 'extends',
                                    srcEntityKey: srcKey,
                                    dstEntityKey: getSymbolEntityKey(importedNamespace.path, last),
                                    metaJson: JSON.stringify({ isNamespaceImport: true }),
                                });
                                return;
                            }

                            // Best-effort local member symbol
                            relations.push({
                                type: 'extends',
                                srcEntityKey: srcKey,
                                dstEntityKey: getSymbolEntityKey(filePath, superName.full),
                                metaJson: JSON.stringify({ isLocal: true, isMember: true }),
                            });
          }
      }
    });

    return relations;
  }
};
