import * as ts from 'typescript';

import type { ControlFlowStateBucket, FunctionWithBodyNode, ResourceWasteFinding, StaticSourceKey } from './types';

import { getNodeHeader } from './node-header';
import { toSpan } from './source-span';

const isFunctionWithBody = (node: ts.Node): node is FunctionWithBodyNode =>
  (ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)) &&
  node.body !== undefined;

const isAssignmentOperator = (operator: ts.SyntaxKind): boolean => {
  return (
    operator === ts.SyntaxKind.EqualsToken ||
    operator === ts.SyntaxKind.PlusEqualsToken ||
    operator === ts.SyntaxKind.MinusEqualsToken ||
    operator === ts.SyntaxKind.AsteriskEqualsToken ||
    operator === ts.SyntaxKind.AsteriskAsteriskEqualsToken ||
    operator === ts.SyntaxKind.SlashEqualsToken ||
    operator === ts.SyntaxKind.PercentEqualsToken ||
    operator === ts.SyntaxKind.AmpersandEqualsToken ||
    operator === ts.SyntaxKind.BarEqualsToken ||
    operator === ts.SyntaxKind.CaretEqualsToken ||
    operator === ts.SyntaxKind.LessThanLessThanEqualsToken ||
    operator === ts.SyntaxKind.GreaterThanGreaterThanEqualsToken ||
    operator === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken ||
    operator === ts.SyntaxKind.BarBarEqualsToken ||
    operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
    operator === ts.SyntaxKind.QuestionQuestionEqualsToken
  );
};

const isCompoundAssignmentOperator = (operator: ts.SyntaxKind): boolean => operator !== ts.SyntaxKind.EqualsToken;

const isNodeWithin = (node: ts.Node, ancestor: ts.Node): boolean => {
  let current: ts.Node | undefined = node;

  while (current !== undefined) {
    if (current === ancestor) {
      return true;
    }

    current = current.parent;
  }

  return false;
};

const getNearestFunctionLikeAncestor = (node: ts.Node): ts.Node | null => {
  let current: ts.Node | undefined = node;

  while (current !== undefined) {
    if (ts.isFunctionLike(current)) {
      return current;
    }

    current = current.parent;
  }

  return null;
};

const isLocalToFunction = (symbol: ts.Symbol, functionNode: FunctionWithBodyNode): boolean => {
  const declarations = symbol.declarations;

  if (declarations === undefined || declarations.length === 0) {
    return false;
  }

  for (const declaration of declarations) {
    if (!isNodeWithin(declaration, functionNode)) {
      continue;
    }

    const owner = getNearestFunctionLikeAncestor(declaration);

    if (owner === functionNode) {
      return true;
    }
  }

  return false;
};

const isInvokedImmediately = (node: ts.Node): boolean => {
  const parent = node.parent;

  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    return parent.expression === node;
  }

  if (ts.isParenthesizedExpression(parent) || ts.isNonNullExpression(parent)) {
    const grandparent = parent.parent;

    if (ts.isCallExpression(grandparent) || ts.isNewExpression(grandparent)) {
      return grandparent.expression === parent;
    }
  }

  if (ts.isAsExpression(parent) || ts.isTypeAssertionExpression(parent) || ts.isSatisfiesExpression(parent)) {
    const grandparent = parent.parent;

    if (ts.isCallExpression(grandparent) || ts.isNewExpression(grandparent)) {
      if (ts.isLeftHandSideExpression(parent)) {
        return grandparent.expression === parent;
      }
    }
  }

  return false;
};

const shouldIgnoreIdentifier = (identifier: ts.Identifier): boolean => {
  const parent = identifier.parent;

  if (ts.isPropertyAccessExpression(parent) && parent.name === identifier) {
    return true;
  }

  if (ts.isPropertyAssignment(parent) && parent.name === identifier) {
    return true;
  }

  if (ts.isMethodDeclaration(parent) && parent.name === identifier) {
    return true;
  }

  if (ts.isFunctionDeclaration(parent) && parent.name === identifier) {
    return true;
  }

  if (ts.isTypeAliasDeclaration(parent) && parent.name === identifier) {
    return true;
  }

  if (ts.isInterfaceDeclaration(parent) && parent.name === identifier) {
    return true;
  }

  if (
    ts.isImportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isImportEqualsDeclaration(parent)
  ) {
    return true;
  }

  if (ts.isExportSpecifier(parent)) {
    return true;
  }

  return false;
};

const getSymbolForIdentifier = (checker: ts.TypeChecker, identifier: ts.Identifier): ts.Symbol | null => {
  const parent = identifier.parent;

  if (ts.isShorthandPropertyAssignment(parent) && parent.name === identifier) {
    const valueSymbol = checker.getShorthandAssignmentValueSymbol(parent);

    if (valueSymbol) {
      return valueSymbol;
    }
  }

  if (shouldIgnoreIdentifier(identifier)) {
    return null;
  }

  const symbol = checker.getSymbolAtLocation(identifier);

  if (!symbol) {
    return null;
  }

  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    const aliased = checker.getAliasedSymbol(symbol);

    return aliased ?? symbol;
  }

  return symbol;
};

const collectBindingIdentifiers = (name: ts.BindingName): readonly ts.Identifier[] => {
  if (ts.isIdentifier(name)) {
    return [name];
  }

  const identifiers: ts.Identifier[] = [];

  const visitBindingName = (bindingName: ts.BindingName): void => {
    if (ts.isIdentifier(bindingName)) {
      identifiers.push(bindingName);

      return;
    }

    if (ts.isObjectBindingPattern(bindingName)) {
      for (const element of bindingName.elements) {
        visitBindingName(element.name);
      }

      return;
    }

    if (ts.isArrayBindingPattern(bindingName)) {
      for (const element of bindingName.elements) {
        if (ts.isOmittedExpression(element)) {
          continue;
        }

        visitBindingName(element.name);
      }
    }
  };

  visitBindingName(name);

  return identifiers;
};

const recordDeadStoreFindings = (
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  functionNode: FunctionWithBodyNode,
): readonly ResourceWasteFinding[] => {
  const findings: ResourceWasteFinding[] = [];
  const findingKeys = new Set<string>();
  const declarationWritePositionsBySymbol = new WeakMap<ts.Symbol, Set<number>>();
  const writeTruthinessBySymbolAndPos = new WeakMap<ts.Symbol, Map<number, boolean | null>>();
  const writeNullishBySymbolAndPos = new WeakMap<ts.Symbol, Map<number, boolean | null>>();
  const terminalStates: Array<Map<ts.Symbol, Map<number, ts.Identifier>>> = [];
  const breakStatesStack: ControlFlowStateBucket[] = [];
  const continueStatesStack: ControlFlowStateBucket[] = [];
  const fnHeader = getNodeHeader(functionNode, checker);

  const createState = (): Map<ts.Symbol, Map<number, ts.Identifier>> => new Map();

  const pushUniqueFinding = (finding: ResourceWasteFinding, key: string): void => {
    if (findingKeys.has(key)) {
      return;
    }

    findingKeys.add(key);
    findings.push(finding);
  };

  const cloneState = (state: Map<ts.Symbol, Map<number, ts.Identifier>>): Map<ts.Symbol, Map<number, ts.Identifier>> => {
    const nextState = createState();

    for (const [symbol, writes] of state.entries()) {
      nextState.set(symbol, new Map(writes));
    }

    return nextState;
  };

  const findNearestUnlabeledBucket = (stack: readonly ControlFlowStateBucket[]): ControlFlowStateBucket | null => {
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      const bucket = stack[index];

      if (bucket === undefined) {
        continue;
      }

      if (bucket.acceptsUnlabeled) {
        return bucket;
      }
    }

    return null;
  };

  const findNearestLabeledBucket = (
    stack: readonly ControlFlowStateBucket[],
    labelText: string,
  ): ControlFlowStateBucket | null => {
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      const bucket = stack[index];

      if (bucket === undefined) {
        continue;
      }

      if (bucket.label === labelText) {
        return bucket;
      }
    }

    return null;
  };

  const recordBreakState = (state: Map<ts.Symbol, Map<number, ts.Identifier>>, labelText: string | null): void => {
    const bucket = labelText !== null
      ? findNearestLabeledBucket(breakStatesStack, labelText)
      : findNearestUnlabeledBucket(breakStatesStack);

    if (bucket === null) {
      return;
    }

    bucket.states.push(cloneState(state));
  };

  const recordContinueState = (state: Map<ts.Symbol, Map<number, ts.Identifier>>, labelText: string | null): void => {
    const bucket = labelText !== null
      ? findNearestLabeledBucket(continueStatesStack, labelText)
      : findNearestUnlabeledBucket(continueStatesStack);

    if (bucket === null) {
      return;
    }

    bucket.states.push(cloneState(state));
  };

  const unionStates = (
    left: Map<ts.Symbol, Map<number, ts.Identifier>>,
    right: Map<ts.Symbol, Map<number, ts.Identifier>>,
  ): Map<ts.Symbol, Map<number, ts.Identifier>> => {
    const out = cloneState(left);

    for (const [symbol, writes] of right.entries()) {
      const existing = out.get(symbol);

      if (!existing) {
        out.set(symbol, new Map(writes));

        continue;
      }

      for (const [pos, id] of writes.entries()) {
        existing.set(pos, id);
      }
    }

    return out;
  };

  const intersectStates = (
    left: Map<ts.Symbol, Map<number, ts.Identifier>>,
    right: Map<ts.Symbol, Map<number, ts.Identifier>>,
  ): Map<ts.Symbol, Map<number, ts.Identifier>> => {
    const out = createState();

    for (const [symbol, leftWrites] of left.entries()) {
      const rightWrites = right.get(symbol);

      if (!rightWrites) {
        continue;
      }

      const shared = new Map<number, ts.Identifier>();

      for (const [pos, id] of leftWrites.entries()) {
        if (rightWrites.has(pos)) {
          shared.set(pos, id);
        }
      }

      if (shared.size > 0) {
        out.set(symbol, shared);
      }
    }

    return out;
  };

  const recordRead = (state: Map<ts.Symbol, Map<number, ts.Identifier>>, identifier: ts.Identifier): void => {
    const symbol = getSymbolForIdentifier(checker, identifier);

    if (!symbol || !isLocalToFunction(symbol, functionNode)) {
      return;
    }

    state.delete(symbol);
  };

  const recordWrite = (
    state: Map<ts.Symbol, Map<number, ts.Identifier>>,
    identifier: ts.Identifier,
    isDeclarationWrite: boolean,
    writeTruthiness: boolean | null,
    writeNullish: boolean | null,
  ): void => {
    const symbol = getSymbolForIdentifier(checker, identifier);

    if (!symbol || !isLocalToFunction(symbol, functionNode)) {
      return;
    }

    const truthinessByPos = writeTruthinessBySymbolAndPos.get(symbol);

    if (truthinessByPos) {
      truthinessByPos.set(identifier.pos, writeTruthiness);
    } else {
      writeTruthinessBySymbolAndPos.set(symbol, new Map([[identifier.pos, writeTruthiness]]));
    }

    const nullishByPos = writeNullishBySymbolAndPos.get(symbol);

    if (nullishByPos) {
      nullishByPos.set(identifier.pos, writeNullish);
    } else {
      writeNullishBySymbolAndPos.set(symbol, new Map([[identifier.pos, writeNullish]]));
    }

    if (isDeclarationWrite) {
      const positions = declarationWritePositionsBySymbol.get(symbol);

      if (positions) {
        positions.add(identifier.pos);
      } else {
        declarationWritePositionsBySymbol.set(symbol, new Set([identifier.pos]));
      }
    }

    const existing = state.get(symbol);

    if ((existing?.size ?? 0) > 0) {
      const existingValues = existing?.values();

      if (existingValues !== undefined) {
        for (const previousWrite of existingValues) {
          const declarationPositions = declarationWritePositionsBySymbol.get(symbol);
          const wasDeclarationInitializer = declarationPositions?.has(previousWrite.pos) ?? false;

          if (wasDeclarationInitializer) {
            continue;
          }

          pushUniqueFinding(
            {
              kind: 'dead-store-overwrite',
              label: `${previousWrite.text} in ${fnHeader.header}`,
              filePath: sourceFile.fileName,
              span: toSpan(sourceFile, previousWrite),
            },
            `dead-store-overwrite:${sourceFile.fileName}:${functionNode.pos}:${previousWrite.pos}`,
          );
        }
      }
    }

    state.set(symbol, new Map([[identifier.pos, identifier]]));
  };

  const recordReadsInAssignmentTarget = (state: Map<ts.Symbol, Map<number, ts.Identifier>>, target: ts.Expression): void => {
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        recordRead(state, node);

        return;
      }

      if (ts.isPropertyAccessExpression(node)) {
        visit(node.expression);

        return;
      }

      if (ts.isElementAccessExpression(node)) {
        visit(node.expression);

        const argument = node.argumentExpression;

        if (argument !== undefined) {
          visit(argument);
        }

        return;
      }

      if (ts.isParenthesizedExpression(node)) {
        visit(node.expression);

        return;
      }

      if (ts.isNonNullExpression(node)) {
        visit(node.expression);

        return;
      }

      if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) {
        visit(node.expression);

        return;
      }

      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        visit(node.expression);

        for (const argument of node.arguments ?? []) {
          visit(argument);
        }

        return;
      }

      ts.forEachChild(node, visit);
    };

    visit(target);
  };

  const unwrapExpression = (expression: ts.Expression): ts.Expression => {
    if (ts.isParenthesizedExpression(expression)) {
      return unwrapExpression(expression.expression);
    }

    return expression;
  };

  const unwrapAssignmentTargetExpression = (expression: ts.Expression): ts.Expression => {
    if (ts.isParenthesizedExpression(expression)) {
      return unwrapAssignmentTargetExpression(expression.expression);
    }

    if (ts.isNonNullExpression(expression)) {
      return unwrapAssignmentTargetExpression(expression.expression);
    }

    if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression)) {
      return unwrapAssignmentTargetExpression(expression.expression);
    }

    return expression;
  };

  const isDefinitelyNotUndefinedValue = (expression: ts.Expression): boolean => {
    const unwrapped = unwrapExpression(expression);

    if (
      ts.isNumericLiteral(unwrapped) ||
      ts.isBigIntLiteral(unwrapped) ||
      ts.isStringLiteral(unwrapped) ||
      ts.isNoSubstitutionTemplateLiteral(unwrapped)
    ) {
      return true;
    }

    if (unwrapped.kind === ts.SyntaxKind.TrueKeyword || unwrapped.kind === ts.SyntaxKind.FalseKeyword) {
      return true;
    }

    if (unwrapped.kind === ts.SyntaxKind.NullKeyword) {
      return true;
    }

    if (ts.isObjectLiteralExpression(unwrapped) || ts.isArrayLiteralExpression(unwrapped)) {
      return true;
    }

    if (
      ts.isArrowFunction(unwrapped) ||
      ts.isFunctionExpression(unwrapped) ||
      ts.isClassExpression(unwrapped) ||
      ts.isRegularExpressionLiteral(unwrapped)
    ) {
      return true;
    }

    return false;
  };

  const tryGetStaticObjectLiteralPropertyValue = (
    objectLiteral: ts.ObjectLiteralExpression,
    propertyKey: string,
  ): ts.Expression | ts.MethodDeclaration | null => {
    for (const property of objectLiteral.properties) {
      if (ts.isSpreadAssignment(property)) {
        return null;
      }

      if (ts.isShorthandPropertyAssignment(property)) {
        if (property.name.text === propertyKey) {
          return property.name;
        }

        continue;
      }

      if (ts.isMethodDeclaration(property)) {
        const methodName = property.name;

        if (ts.isIdentifier(methodName) && methodName.text === propertyKey) {
          return property;
        }

        if (ts.isStringLiteral(methodName) && methodName.text === propertyKey) {
          return property;
        }

        continue;
      }

      if (ts.isPropertyAssignment(property)) {
        const propertyName = property.name;

        if (ts.isComputedPropertyName(propertyName)) {
          return null;
        }

        let candidateKey: string | null = null;

        if (ts.isIdentifier(propertyName)) {
          candidateKey = propertyName.text;
        } else if (ts.isStringLiteral(propertyName) || ts.isNumericLiteral(propertyName)) {
          candidateKey = propertyName.text;
        }

        if (candidateKey === propertyKey) {
          return property.initializer;
        }
      }
    }

    return null;
  };

  const shouldEvaluateDestructuringDefaultInitializer = (
    sourceExpression: ts.Expression,
    sourceKey: StaticSourceKey,
  ): boolean => {
    const sourceUnwrapped = unwrapExpression(sourceExpression);

    if (sourceKey.kind === 'object') {
      if (!ts.isObjectLiteralExpression(sourceUnwrapped)) {
        return true;
      }

      const propertyValue = tryGetStaticObjectLiteralPropertyValue(sourceUnwrapped, sourceKey.propertyKey);

      if (propertyValue === null) {
        return true;
      }

      if (ts.isMethodDeclaration(propertyValue)) {
        return false;
      }

      const valueUnwrapped = unwrapExpression(propertyValue);

      if (ts.isVoidExpression(valueUnwrapped)) {
        return true;
      }

      return !isDefinitelyNotUndefinedValue(valueUnwrapped);
    }

    if (!ts.isArrayLiteralExpression(sourceUnwrapped)) {
      return true;
    }

    const index = sourceKey.index;
    const element = sourceUnwrapped.elements[index];

    if (!element || ts.isOmittedExpression(element)) {
      return true;
    }

    if (ts.isSpreadElement(element)) {
      return true;
    }

    const elementUnwrapped = unwrapExpression(element);

    if (ts.isVoidExpression(elementUnwrapped)) {
      return true;
    }

    return !isDefinitelyNotUndefinedValue(elementUnwrapped);
  };

  const visitBindingNameDefaultInitializers = (
    state: Map<ts.Symbol, Map<number, ts.Identifier>>,
    bindingName: ts.BindingName,
    sourceExpression: ts.Expression,
  ): void => {
    const visitBinding = (name: ts.BindingName, source: ts.Expression): void => {
      if (ts.isIdentifier(name)) {
        return;
      }

      if (ts.isObjectBindingPattern(name)) {
        for (const element of name.elements) {
          const initializer = element.initializer;
          let propertyKey: string | null = null;

          if (element.propertyName) {
            if (ts.isIdentifier(element.propertyName)) {
              propertyKey = element.propertyName.text;
            } else if (ts.isStringLiteral(element.propertyName) || ts.isNumericLiteral(element.propertyName)) {
              propertyKey = element.propertyName.text;
            }
          } else if (ts.isIdentifier(element.name)) {
            propertyKey = element.name.text;
          }

          if (initializer !== undefined && propertyKey !== null) {
            const shouldEvaluate = shouldEvaluateDestructuringDefaultInitializer(source, {
              kind: 'object',
              propertyKey,
            });

            if (shouldEvaluate) {
              visitExpression(state, initializer);
            }
          } else if (initializer !== undefined) {
            visitExpression(state, initializer);
          }

          const sourceUnwrapped = unwrapExpression(source);

          if (ts.isObjectLiteralExpression(sourceUnwrapped) && propertyKey !== null) {
            const nestedSource = tryGetStaticObjectLiteralPropertyValue(sourceUnwrapped, propertyKey);

            if (nestedSource !== undefined && nestedSource !== null && ts.isExpression(nestedSource)) {
              visitBinding(element.name, nestedSource);

              continue;
            }
          }

          visitBinding(element.name, source);
        }

        return;
      }

      if (ts.isArrayBindingPattern(name)) {
        let elementIndex = 0;

        for (const element of name.elements) {
          if (ts.isOmittedExpression(element)) {
            elementIndex += 1;

            continue;
          }

          const initializer = element.initializer;

          if (initializer !== undefined) {
            const shouldEvaluate = shouldEvaluateDestructuringDefaultInitializer(source, {
              kind: 'array',
              index: elementIndex,
            });

            if (shouldEvaluate) {
              visitExpression(state, initializer);
            }
          }

          const sourceUnwrapped = unwrapExpression(source);

          if (ts.isArrayLiteralExpression(sourceUnwrapped)) {
            const nestedSource = sourceUnwrapped.elements[elementIndex];

            if (nestedSource && !ts.isOmittedExpression(nestedSource) && !ts.isSpreadElement(nestedSource)) {
              visitBinding(element.name, nestedSource);

              elementIndex += 1;

              continue;
            }
          }

          visitBinding(element.name, source);

          elementIndex += 1;
        }
      }
    };

    visitBinding(bindingName, sourceExpression);
  };

  const visitDestructuringAssignmentTargetDefaultInitializers = (
    state: Map<ts.Symbol, Map<number, ts.Identifier>>,
    assignmentTarget: ts.Expression,
    sourceExpression: ts.Expression,
  ): void => {
    const visitTarget = (target: ts.Expression, source: ts.Expression): void => {
      const unwrappedTarget = unwrapAssignmentTargetExpression(target);
      const sourceUnwrapped = unwrapExpression(source);

      if (ts.isObjectLiteralExpression(unwrappedTarget)) {
        for (const property of unwrappedTarget.properties) {
          if (ts.isSpreadAssignment(property)) {
            continue;
          }

          if (ts.isShorthandPropertyAssignment(property)) {
            continue;
          }

          if (ts.isPropertyAssignment(property)) {
            const propertyName = property.name;

            if (ts.isComputedPropertyName(propertyName)) {
              continue;
            }

            let propertyKey: string | null = null;

            if (ts.isIdentifier(propertyName)) {
              propertyKey = propertyName.text;
            } else if (ts.isStringLiteral(propertyName) || ts.isNumericLiteral(propertyName)) {
              propertyKey = propertyName.text;
            }

            const valueTarget = property.initializer;
            const valueUnwrapped = unwrapExpression(valueTarget);

            if (ts.isBinaryExpression(valueUnwrapped) && valueUnwrapped.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
              if (valueUnwrapped.right !== undefined && propertyKey !== null) {
                const shouldEvaluate = shouldEvaluateDestructuringDefaultInitializer(source, {
                  kind: 'object',
                  propertyKey,
                });

                if (shouldEvaluate) {
                  visitExpression(state, valueUnwrapped.right);
                }
              } else if (valueUnwrapped.right !== undefined) {
                visitExpression(state, valueUnwrapped.right);
              }

              if (ts.isObjectLiteralExpression(sourceUnwrapped) && propertyKey !== null) {
                const nestedSource = tryGetStaticObjectLiteralPropertyValue(sourceUnwrapped, propertyKey);

                if (nestedSource !== undefined && nestedSource !== null && ts.isExpression(nestedSource)) {
                  visitTarget(valueUnwrapped.left, nestedSource);

                  continue;
                }
              }

              visitTarget(valueUnwrapped.left, source);

              continue;
            }

            if (
              ts.isObjectLiteralExpression(valueUnwrapped) ||
              ts.isArrayLiteralExpression(valueUnwrapped) ||
              ts.isBinaryExpression(valueUnwrapped)
            ) {
              if (ts.isObjectLiteralExpression(sourceUnwrapped) && propertyKey !== null) {
                const nestedSource = tryGetStaticObjectLiteralPropertyValue(sourceUnwrapped, propertyKey);

                if (nestedSource !== undefined && nestedSource !== null && ts.isExpression(nestedSource)) {
                  visitTarget(valueUnwrapped, nestedSource);

                  continue;
                }
              }

              visitTarget(valueUnwrapped, source);
            }
          }
        }

        return;
      }

      if (ts.isArrayLiteralExpression(unwrappedTarget)) {
        const sourceArray = ts.isArrayLiteralExpression(sourceUnwrapped) ? sourceUnwrapped : null;

        for (let index = 0; index < unwrappedTarget.elements.length; index += 1) {
          const element = unwrappedTarget.elements[index];

          if (!element || ts.isOmittedExpression(element)) {
            continue;
          }

          if (ts.isSpreadElement(element)) {
            continue;
          }

          const elementUnwrapped = unwrapExpression(element);

          if (ts.isBinaryExpression(elementUnwrapped) && elementUnwrapped.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const shouldEvaluate = shouldEvaluateDestructuringDefaultInitializer(source, { kind: 'array', index });

            if (shouldEvaluate) {
              visitExpression(state, elementUnwrapped.right);
            }

            const nestedSource = sourceArray ? sourceArray.elements[index] : null;

            if (nestedSource && !ts.isOmittedExpression(nestedSource) && !ts.isSpreadElement(nestedSource)) {
              visitTarget(elementUnwrapped.left, nestedSource);

              continue;
            }

            visitTarget(elementUnwrapped.left, source);

            continue;
          }

          if (ts.isObjectLiteralExpression(elementUnwrapped) || ts.isArrayLiteralExpression(elementUnwrapped)) {
            const nestedSource = sourceArray ? sourceArray.elements[index] : null;

            if (nestedSource && !ts.isOmittedExpression(nestedSource) && !ts.isSpreadElement(nestedSource)) {
              visitTarget(elementUnwrapped, nestedSource);
            } else {
              visitTarget(elementUnwrapped, source);
            }
          }
        }
      }
    };

    visitTarget(assignmentTarget, sourceExpression);
  };

  const isDestructuringAssignmentTarget = (expression: ts.Expression): boolean => {
    const unwrapped = unwrapAssignmentTargetExpression(expression);

    return ts.isObjectLiteralExpression(unwrapped) || ts.isArrayLiteralExpression(unwrapped);
  };

  const collectDestructuringAssignmentIdentifiers = (expression: ts.Expression): readonly ts.Identifier[] => {
    const identifiers: ts.Identifier[] = [];

    const visitTarget = (targetExpression: ts.Expression): void => {
      const unwrapped = unwrapAssignmentTargetExpression(targetExpression);

      if (ts.isIdentifier(unwrapped)) {
        identifiers.push(unwrapped);

        return;
      }

      if (ts.isBinaryExpression(unwrapped) && unwrapped.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        visitTarget(unwrapped.left);

        return;
      }

      if (ts.isObjectLiteralExpression(unwrapped)) {
        for (const property of unwrapped.properties) {
          if (ts.isShorthandPropertyAssignment(property)) {
            identifiers.push(property.name);

            continue;
          }

          if (ts.isPropertyAssignment(property)) {
            visitTarget(property.initializer);

            continue;
          }

          if (ts.isSpreadAssignment(property)) {
            visitTarget(property.expression);
          }
        }

        return;
      }

      if (ts.isArrayLiteralExpression(unwrapped)) {
        for (const element of unwrapped.elements) {
          if (ts.isOmittedExpression(element)) {
            continue;
          }

          if (ts.isSpreadElement(element)) {
            visitTarget(element.expression);

            continue;
          }

          visitTarget(element);
        }
      }
    };

    visitTarget(expression);

    return identifiers;
  };

  const tryEvaluateStaticTruthiness = (expression: ts.Expression): boolean | null => {
    const unwrapped = unwrapExpression(expression);

    if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    }

    if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    }

    if (unwrapped.kind === ts.SyntaxKind.NullKeyword) {
      return false;
    }

    if (ts.isNumericLiteral(unwrapped)) {
      const asNumber = Number(unwrapped.text);

      return asNumber !== 0;
    }

    if (ts.isBigIntLiteral(unwrapped)) {
      return unwrapped.text !== '0n';
    }

    if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
      return unwrapped.text.length !== 0;
    }

    if (ts.isVoidExpression(unwrapped)) {
      return false;
    }

    if (ts.isPrefixUnaryExpression(unwrapped) && unwrapped.operator === ts.SyntaxKind.ExclamationToken) {
      const inner = tryEvaluateStaticTruthiness(unwrapped.operand);

      return inner === null ? null : !inner;
    }

    return null;
  };

  const tryEvaluateStaticNullish = (expression: ts.Expression): boolean | null => {
    const unwrapped = unwrapExpression(expression);

    if (unwrapped.kind === ts.SyntaxKind.NullKeyword) {
      return true;
    }

    if (ts.isVoidExpression(unwrapped)) {
      return true;
    }

    if (
      unwrapped.kind === ts.SyntaxKind.TrueKeyword ||
      unwrapped.kind === ts.SyntaxKind.FalseKeyword ||
      ts.isNumericLiteral(unwrapped) ||
      ts.isBigIntLiteral(unwrapped) ||
      ts.isStringLiteral(unwrapped) ||
      ts.isNoSubstitutionTemplateLiteral(unwrapped)
    ) {
      return false;
    }

    return null;
  };

  const tryEvaluateStaticSwitchValueKey = (expression: ts.Expression): string | null => {
    const unwrapped = unwrapExpression(expression);

    if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) {
      return 'b:true';
    }

    if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) {
      return 'b:false';
    }

    if (unwrapped.kind === ts.SyntaxKind.NullKeyword) {
      return 'null';
    }

    if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
      return `s:${unwrapped.text}`;
    }

    if (ts.isNumericLiteral(unwrapped)) {
      return `n:${unwrapped.text}`;
    }

    if (ts.isBigIntLiteral(unwrapped)) {
      return `big:${unwrapped.text}`;
    }

    if (ts.isVoidExpression(unwrapped)) {
      return 'undef';
    }

    return null;
  };

  const visitExpression = (state: Map<ts.Symbol, Map<number, ts.Identifier>>, node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      recordRead(state, node);

      return;
    }

    if (ts.isConditionalExpression(node)) {
      visitExpression(state, node.condition);

      const condition = tryEvaluateStaticTruthiness(node.condition);

      if (condition === true) {
        visitExpression(state, node.whenTrue);

        return;
      }

      if (condition === false) {
        visitExpression(state, node.whenFalse);

        return;
      }

      visitExpression(state, node.whenTrue);
      visitExpression(state, node.whenFalse);

      return;
    }

    if (ts.isClassLike(node)) {
      return;
    }

    if (isFunctionWithBody(node)) {
      if (node.body && isInvokedImmediately(node)) {
        visitExpression(state, node.body);
      }

      return;
    }

    if (ts.isVariableDeclaration(node)) {
      if (node.initializer) {
        const initializerTruthiness = tryEvaluateStaticTruthiness(node.initializer);
        const initializerNullish = tryEvaluateStaticNullish(node.initializer);

        visitExpression(state, node.initializer);

        visitBindingNameDefaultInitializers(state, node.name, node.initializer);

        for (const identifier of collectBindingIdentifiers(node.name)) {
          recordWrite(state, identifier, true, initializerTruthiness, initializerNullish);
        }
      }

      return;
    }

    if (ts.isBinaryExpression(node) && isAssignmentOperator(node.operatorToken.kind)) {
      const operator = node.operatorToken.kind;
      const left = node.left;

      if (
        (operator === ts.SyntaxKind.BarBarEqualsToken ||
          operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
          operator === ts.SyntaxKind.QuestionQuestionEqualsToken) &&
        ts.isIdentifier(left)
      ) {
        const symbol = getSymbolForIdentifier(checker, left);
        const pendingWrites = symbol ? state.get(symbol) : undefined;
        let lastWriteTruthiness: boolean | null = null;
        let lastWriteNullish: boolean | null = null;

        if (symbol !== null && (pendingWrites?.size ?? 0) > 0) {
          const iterator = pendingWrites?.keys();

          if (iterator !== undefined) {
            const firstPos = iterator.next().value;

            if (typeof firstPos === 'number') {
              lastWriteTruthiness = writeTruthinessBySymbolAndPos.get(symbol)?.get(firstPos) ?? null;
              lastWriteNullish = writeNullishBySymbolAndPos.get(symbol)?.get(firstPos) ?? null;
            }
          }
        }

        recordRead(state, left);

        if (operator === ts.SyntaxKind.BarBarEqualsToken && lastWriteTruthiness === true) {
          return;
        }

        if (operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken && lastWriteTruthiness === false) {
          return;
        }

        if (operator === ts.SyntaxKind.QuestionQuestionEqualsToken && lastWriteNullish === false) {
          return;
        }

        const rightTruthiness = tryEvaluateStaticTruthiness(node.right);
        const rightNullish = tryEvaluateStaticNullish(node.right);

        visitExpression(state, node.right);
        recordWrite(state, left, false, rightTruthiness, rightNullish);

        return;
      }

      const rightTruthiness = operator === ts.SyntaxKind.EqualsToken ? tryEvaluateStaticTruthiness(node.right) : null;
      const rightNullish = operator === ts.SyntaxKind.EqualsToken ? tryEvaluateStaticNullish(node.right) : null;

      visitExpression(state, node.right);

      const isDestructuringTarget = isDestructuringAssignmentTarget(left);

      if (operator === ts.SyntaxKind.EqualsToken && isDestructuringTarget) {
        visitDestructuringAssignmentTargetDefaultInitializers(state, left, node.right);
      }

      if (!ts.isIdentifier(left) && !isDestructuringTarget) {
        recordReadsInAssignmentTarget(state, left);
      }

      if (isCompoundAssignmentOperator(node.operatorToken.kind)) {
        if (ts.isIdentifier(left)) {
          recordRead(state, left);
        }
      }

      if (ts.isIdentifier(left)) {
        recordWrite(state, left, false, rightTruthiness, rightNullish);

        return;
      }

      if (isDestructuringTarget) {
        for (const identifier of collectDestructuringAssignmentIdentifiers(left)) {
          recordWrite(state, identifier, false, null, null);
        }
      }

      return;
    }

    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;

      if (
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      ) {
        visitExpression(state, node.left);

        if (operator === ts.SyntaxKind.QuestionQuestionToken) {
          const left = unwrapExpression(node.left);

          if (left.kind === ts.SyntaxKind.NullKeyword) {
            visitExpression(state, node.right);

            return;
          }

          if (ts.isVoidExpression(left)) {
            visitExpression(state, node.right);

            return;
          }
        }

        const leftBool = tryEvaluateStaticTruthiness(node.left);

        if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
          if (leftBool === false) {
            return;
          }

          visitExpression(state, node.right);

          return;
        }

        if (operator === ts.SyntaxKind.BarBarToken) {
          if (leftBool === true) {
            return;
          }

          visitExpression(state, node.right);

          return;
        }

        visitExpression(state, node.right);

        return;
      }
    }

    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
      const operator = node.operator;

      if (operator === ts.SyntaxKind.PlusPlusToken || operator === ts.SyntaxKind.MinusMinusToken) {
        const operand = node.operand;

        if (ts.isIdentifier(operand)) {
          recordRead(state, operand);
          recordWrite(state, operand, false, null, null);

          return;
        }
      }
    }

    ts.forEachChild(node, child => {
      visitExpression(state, child);
    });
  };

  const analyzeStatement = (
    state: Map<ts.Symbol, Map<number, ts.Identifier>>,
    statement: ts.Statement,
    activeLabel: string | null = null,
  ): readonly Map<ts.Symbol, Map<number, ts.Identifier>>[] => {
    if (ts.isBreakStatement(statement)) {
      const labelText = statement.label?.text ?? null;

      recordBreakState(state, labelText);

      return [];
    }

    if (ts.isContinueStatement(statement)) {
      const labelText = statement.label?.text ?? null;

      recordContinueState(state, labelText);

      return [];
    }

    if (ts.isLabeledStatement(statement)) {
      const labelText = statement.label.text;
      const labeledBreakBucket: ControlFlowStateBucket = {
        label: labelText,
        acceptsUnlabeled: false,
        states: [],
      };

      breakStatesStack.push(labeledBreakBucket);

      const outStates = analyzeStatement(cloneState(state), statement.statement, labelText);
      const recordedBreaks = breakStatesStack.pop()?.states ?? [];

      return outStates.concat(recordedBreaks);
    }

    if (ts.isBlock(statement)) {
      return analyzeStatements(state, statement.statements);
    }

    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      return [cloneState(state)];
    }

    if (ts.isIfStatement(statement)) {
      const afterCond = cloneState(state);

      visitExpression(afterCond, statement.expression);

      const condition = tryEvaluateStaticTruthiness(statement.expression);

      if (condition === true) {
        return analyzeStatement(afterCond, statement.thenStatement);
      }

      if (condition === false) {
        const elseStatement = statement.elseStatement;

        return elseStatement ? analyzeStatement(afterCond, elseStatement) : [cloneState(afterCond)];
      }

      const thenOut = analyzeStatement(afterCond, statement.thenStatement);
      const elseStatement = statement.elseStatement;
      const elseOut = elseStatement ? analyzeStatement(cloneState(afterCond), elseStatement) : [cloneState(afterCond)];

      return [...thenOut, ...elseOut];
    }

    if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
      const nextState = cloneState(state);

      if ('expression' in statement && statement.expression !== undefined) {
        visitExpression(nextState, statement.expression);
      }

      terminalStates.push(nextState);

      return [];
    }

    if (ts.isWhileStatement(statement) || ts.isDoStatement(statement) || ts.isForStatement(statement)) {
      const entry = cloneState(state);
      const loopBreakBucket: ControlFlowStateBucket = {
        label: activeLabel,
        acceptsUnlabeled: true,
        states: [],
      };
      const loopContinueBucket: ControlFlowStateBucket = {
        label: activeLabel,
        acceptsUnlabeled: true,
        states: [],
      };

      breakStatesStack.push(loopBreakBucket);
      continueStatesStack.push(loopContinueBucket);

      if (ts.isForStatement(statement)) {
        if (statement.initializer !== undefined) {
          visitExpression(entry, statement.initializer);
        }
      }

      if (ts.isDoStatement(statement)) {
        const bodyOutOnce = analyzeStatement(cloneState(entry), statement.statement);
        const loopContinueStates = continueStatesStack.pop()?.states ?? [];
        const loopBreakStates = breakStatesStack.pop()?.states ?? [];
        const bodyMerged = bodyOutOnce.concat(loopContinueStates).reduce((acc, s) => unionStates(acc, s), createState());

        if (statement.expression !== undefined) {
          visitExpression(bodyMerged, statement.expression);
        }

        return [bodyMerged, ...loopBreakStates];
      }

      let conditionTruthiness: boolean | null = null;

      if (ts.isForStatement(statement)) {
        if (statement.condition !== undefined) {
          visitExpression(entry, statement.condition);

          conditionTruthiness = tryEvaluateStaticTruthiness(statement.condition);
        } else {
          conditionTruthiness = true;
        }
      } else if (statement.expression !== undefined) {
        visitExpression(entry, statement.expression);

        conditionTruthiness = tryEvaluateStaticTruthiness(statement.expression);
      }

      if (conditionTruthiness === false) {
        continueStatesStack.pop();
        breakStatesStack.pop();

        return [entry];
      }

      const bodyOutOnce = analyzeStatement(cloneState(entry), statement.statement);
      const loopContinueStates = continueStatesStack.pop()?.states ?? [];
      const loopBreakStates = breakStatesStack.pop()?.states ?? [];
      const bodyMerged = bodyOutOnce.concat(loopContinueStates).reduce((acc, s) => unionStates(acc, s), createState());

      if (ts.isForStatement(statement) && statement.incrementor !== undefined) {
        visitExpression(bodyMerged, statement.incrementor);
      }

      if (conditionTruthiness === true) {
        return [bodyMerged, ...loopBreakStates];
      }

      return [entry, bodyMerged, ...loopBreakStates];
    }

    if (ts.isForOfStatement(statement) || ts.isForInStatement(statement)) {
      const beforeIteration = cloneState(state);
      const loopBreakBucket: ControlFlowStateBucket = {
        label: activeLabel,
        acceptsUnlabeled: true,
        states: [],
      };
      const loopContinueBucket: ControlFlowStateBucket = {
        label: activeLabel,
        acceptsUnlabeled: true,
        states: [],
      };

      breakStatesStack.push(loopBreakBucket);
      continueStatesStack.push(loopContinueBucket);

      visitExpression(beforeIteration, statement.expression);

      const iterationEntry = cloneState(beforeIteration);
      const initializer = statement.initializer;

      if (ts.isVariableDeclarationList(initializer)) {
        for (const declaration of initializer.declarations) {
          for (const identifier of collectBindingIdentifiers(declaration.name)) {
            recordWrite(iterationEntry, identifier, true, null, null);
          }
        }
      } else if (ts.isIdentifier(initializer)) {
        recordWrite(iterationEntry, initializer, false, null, null);
      }

      const bodyOutOnce = analyzeStatement(cloneState(iterationEntry), statement.statement);
      const loopContinueStates = continueStatesStack.pop()?.states ?? [];
      const loopBreakStates = breakStatesStack.pop()?.states ?? [];
      const bodyMerged = bodyOutOnce.concat(loopContinueStates).reduce((acc, s) => unionStates(acc, s), createState());

      return [beforeIteration, bodyMerged, ...loopBreakStates];
    }

    if (ts.isSwitchStatement(statement)) {
      const entry = cloneState(state);
      const switchBreakBucket: ControlFlowStateBucket = {
        label: activeLabel,
        acceptsUnlabeled: true,
        states: [],
      };

      breakStatesStack.push(switchBreakBucket);

      visitExpression(entry, statement.expression);

      const clauses = statement.caseBlock.clauses;
      const exits: Map<ts.Symbol, Map<number, ts.Identifier>>[] = [];
      let defaultIndex: number | null = null;

      for (let clauseIndex = 0; clauseIndex < clauses.length; clauseIndex += 1) {
        const clause = clauses[clauseIndex];

        if (!clause) {
          continue;
        }

        if (ts.isDefaultClause(clause)) {
          defaultIndex = clauseIndex;

          break;
        }
      }

      const analyzeFallthroughFromIndex = (startIndex: number, startState: Map<ts.Symbol, Map<number, ts.Identifier>>): void => {
        let states: ReadonlyArray<Map<ts.Symbol, Map<number, ts.Identifier>>> = [cloneState(startState)];

        for (let clauseIndex = startIndex; clauseIndex < clauses.length; clauseIndex += 1) {
          const clause = clauses[clauseIndex];

          if (clause === undefined) {
            continue;
          }

          states = clause.statements.reduce((acc, stmt) => acc.flatMap(current => analyzeStatement(current, stmt)), states);

          if (states.length === 0) {
            break;
          }
        }

        exits.push(...states);
      };

      const discriminantKey = tryEvaluateStaticSwitchValueKey(statement.expression);

      if (discriminantKey !== null) {
        let matchedIndex: number | null = null;
        let hitUnknownCaseBeforeMatch = false;

        for (let clauseIndex = 0; clauseIndex < clauses.length; clauseIndex += 1) {
          const clause = clauses[clauseIndex];

          if (clause === undefined || !ts.isCaseClause(clause)) {
            continue;
          }

          const caseKey = tryEvaluateStaticSwitchValueKey(clause.expression);

          if (caseKey === null) {
            hitUnknownCaseBeforeMatch = true;

            break;
          }

          if (caseKey === discriminantKey) {
            matchedIndex = clauseIndex;

            break;
          }
        }

        if (!hitUnknownCaseBeforeMatch) {
          if (matchedIndex !== null) {
            const selectorState = cloneState(entry);

            for (let clauseIndex = 0; clauseIndex <= matchedIndex; clauseIndex += 1) {
              const clause = clauses[clauseIndex];

              if (clause !== undefined && ts.isCaseClause(clause)) {
                visitExpression(selectorState, clause.expression);
              }
            }

            analyzeFallthroughFromIndex(matchedIndex, selectorState);
          } else if (defaultIndex !== null) {
            const selectorState = cloneState(entry);

            for (const clause of clauses) {
              if (clause !== undefined && ts.isCaseClause(clause)) {
                visitExpression(selectorState, clause.expression);
              }
            }

            analyzeFallthroughFromIndex(defaultIndex, selectorState);
          } else {
            for (const clause of clauses) {
              if (clause !== undefined && ts.isCaseClause(clause)) {
                visitExpression(entry, clause.expression);
              }
            }

            exits.push(entry);
          }

          const recordedBreaks = breakStatesStack.pop()?.states ?? [];
          const mergedExits = exits.concat(recordedBreaks);

          return mergedExits.length > 0 ? mergedExits : [entry];
        }
      }

      for (let startIndex = 0; startIndex < clauses.length; startIndex += 1) {
        const clause = clauses[startIndex];

        if (clause === undefined) {
          continue;
        }

        const selectorState = cloneState(entry);

        if (ts.isDefaultClause(clause)) {
          for (const candidate of clauses) {
            if (candidate !== undefined && ts.isCaseClause(candidate)) {
              visitExpression(selectorState, candidate.expression);
            }
          }
        } else if (ts.isCaseClause(clause)) {
          for (let clauseIndex = 0; clauseIndex <= startIndex; clauseIndex += 1) {
            const candidate = clauses[clauseIndex];

            if (candidate !== undefined && ts.isCaseClause(candidate)) {
              visitExpression(selectorState, candidate.expression);
            }
          }
        } else {
          continue;
        }

        analyzeFallthroughFromIndex(startIndex, selectorState);
      }

      if (defaultIndex === null) {
        const noMatchState = cloneState(entry);

        for (const clause of clauses) {
          if (clause !== undefined && ts.isCaseClause(clause)) {
            visitExpression(noMatchState, clause.expression);
          }
        }

        exits.push(noMatchState);
      }

      const recordedBreaks = breakStatesStack.pop()?.states ?? [];
      const mergedExits = exits.concat(recordedBreaks);

      return mergedExits.length > 0 ? mergedExits : [entry];
    }

    if (ts.isTryStatement(statement)) {
      const finallyBlock = statement.finallyBlock;

      if (!finallyBlock) {
        const tryOut = analyzeStatement(cloneState(state), statement.tryBlock);
        const catchClause = statement.catchClause;
        const catchOut = catchClause ? analyzeStatement(cloneState(state), catchClause.block) : [];

        return [...tryOut, ...catchOut];
      }

      const terminalStartIndex = terminalStates.length;
      const tryOut = analyzeStatement(cloneState(state), statement.tryBlock);
      const catchClause = statement.catchClause;
      const catchOut = catchClause ? analyzeStatement(cloneState(state), catchClause.block) : [];
      const terminalFromTry = terminalStates.splice(terminalStartIndex);
      const normalStates = [...tryOut, ...catchOut];
      const afterFinally = normalStates.flatMap(s => analyzeStatement(s, finallyBlock));
      const terminalAfterFinally = terminalFromTry.flatMap(s => analyzeStatement(s, finallyBlock));

      for (const terminalState of terminalAfterFinally) {
        terminalStates.push(terminalState);
      }

      return afterFinally;
    }

    if (ts.isExpressionStatement(statement)) {
      const nextState = cloneState(state);

      visitExpression(nextState, statement.expression);

      return [nextState];
    }

    if (ts.isVariableStatement(statement)) {
      const nextState = cloneState(state);

      for (const declaration of statement.declarationList.declarations) {
        visitExpression(nextState, declaration);
      }

      return [nextState];
    }

    const nextState = cloneState(state);

    ts.forEachChild(statement, node => {
      visitExpression(nextState, node);
    });

    return [nextState];
  };

  const analyzeStatements = (
    state: Map<ts.Symbol, Map<number, ts.Identifier>>,
    statements: readonly ts.Statement[],
  ): readonly Map<ts.Symbol, Map<number, ts.Identifier>>[] => {
    let states: ReadonlyArray<Map<ts.Symbol, Map<number, ts.Identifier>>> = [cloneState(state)];

    for (const statement of statements) {
      states = states.flatMap(s => analyzeStatement(s, statement));

      if (states.length === 0) {
        return [];
      }
    }

    return states;
  };

  const body = functionNode.body;

  if (body === undefined) {
    return [];
  }

  const endStates = ts.isBlock(body)
    ? analyzeStatements(createState(), body.statements)
    : (() => {
        const entry = createState();

        if (body !== undefined) {
          visitExpression(entry, body);
        }

        return [entry];
      })();
  const allEndStates = [...endStates, ...terminalStates];

  if (allEndStates.length === 0) {
    return findings;
  }

  const firstState = allEndStates[0];

  if (firstState === undefined) {
    return findings;
  }

  const mustUnreadAtExit = allEndStates.slice(1).reduce((acc, state) => intersectStates(acc, state), firstState);

  for (const writes of mustUnreadAtExit.values()) {
    for (const unreadWrite of writes.values()) {
      pushUniqueFinding(
        {
          kind: 'dead-store',
          label: `${unreadWrite.text} in ${fnHeader.header}`,
          filePath: sourceFile.fileName,
          span: toSpan(sourceFile, unreadWrite),
        },
        `dead-store:${sourceFile.fileName}:${functionNode.pos}:${unreadWrite.pos}`,
      );
    }
  }

  return findings;
};

const detectDeadStoresInNode = (
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  node: ts.Node,
): readonly ResourceWasteFinding[] => {
  if (!isFunctionWithBody(node)) {
    return [];
  }

  return recordDeadStoreFindings(checker, sourceFile, node);
};

const detectResourceWaste = (program: ts.Program): readonly ResourceWasteFinding[] => {
  const checker = program.getTypeChecker();
  const findings: ResourceWasteFinding[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) {
      continue;
    }

    const visit = (node: ts.Node): void => {
      findings.push(...detectDeadStoresInNode(checker, sourceFile, node));
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return findings.sort((a, b) => {
    if (a.filePath !== b.filePath) {
      return a.filePath.localeCompare(b.filePath);
    }

    return a.span.start.line - b.span.start.line;
  });
};

export { detectResourceWaste };
