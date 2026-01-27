import { parseSync } from 'oxc-parser';
import { dirname, resolve } from 'path';

import type { ClassMetadata, DecoratorMetadata, ImportEntry } from './interfaces';
import type { ModuleDefinition, ParseResult, ReExport } from './parser-models';
import type {
  AnalyzerValue,
  AnalyzerValueRecord,
  ExtractedParam,
  FactoryDependency,
  NodeRecord,
  ReExportName,
  TypeInfo,
} from './types';

import { AstTypeResolver } from './ast-type-resolver';

const UNKNOWN_TYPE_NAME = 'Unknown';
const UNKNOWN_CALLEE_NAME = 'unknown';

function isNonEmptyString(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value !== '';
}

function isNullish(value: AnalyzerValue): value is null | undefined {
  return value === null || value === undefined;
}

function asAnalyzerArray(value: AnalyzerValue): AnalyzerValue[] | null {
  return Array.isArray(value) ? value : null;
}

function isAnalyzerRecord(value: AnalyzerValue): value is AnalyzerValueRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeRecord(record: AnalyzerValueRecord): record is NodeRecord {
  return typeof record.type === 'string';
}

export class AstParser {
  private currentCode: string = '';
  private typeResolver = new AstTypeResolver();
  private currentImports: Record<string, string> = {};

  parse(filename: string, code: string): ParseResult {
    this.currentCode = code;

    const result = parseSync(filename, code);
    const classes: ClassMetadata[] = [];
    const reExports: ReExport[] = [];
    const localExports: string[] = [];
    const imports: Record<string, string> = {};
    const importEntries: ImportEntry[] = [];
    const localValues: AnalyzerValueRecord = {};
    const exportedValues: AnalyzerValueRecord = {};

    this.currentImports = {};

    let moduleDefinition: ModuleDefinition | undefined;

    const traverse = (nodeValue: AnalyzerValue): void => {
      const node = this.asNode(nodeValue);

      if (!node) {
        return;
      }

      if (node.type === 'ImportDeclaration') {
        const importKind = this.getString(node, 'importKind');

        if (importKind === 'type') {
          return;
        }

        const sourceValue = this.getNodeStringValue(node, 'source');

        if (!isNonEmptyString(sourceValue)) {
          return;
        }

        const resolvedSource = this.resolvePath(filename, sourceValue);

        importEntries.push({ source: sourceValue, resolvedSource, isRelative: sourceValue.startsWith('.') });

        const specifiersValue = node.specifiers;
        const specifiers = asAnalyzerArray(specifiersValue);

        if (!specifiers) {
          return;
        }

        for (const specValue of specifiers) {
          const spec = this.asNode(specValue);

          if (!spec) {
            continue;
          }

          const specImportKind = this.getString(spec, 'importKind');

          if (specImportKind === 'type') {
            continue;
          }

          const local = this.asNode(spec.local);
          const localName = local ? this.getString(local, 'name') : null;

          if (!isNonEmptyString(localName)) {
            continue;
          }

          imports[localName] = resolvedSource;

          this.currentImports[localName] = resolvedSource;
        }

        return;
      }

      if (node.type === 'ExportAllDeclaration') {
        const sourceValue = this.getNodeStringValue(node, 'source');

        if (!isNonEmptyString(sourceValue)) {
          return;
        }

        const resolvedSource = this.resolvePath(filename, sourceValue);

        reExports.push({
          module: resolvedSource,
          exportAll: true,
        });

        return;
      }

      if (node.type === 'ExportNamedDeclaration') {
        if (node.source !== undefined && node.source !== null) {
          const sourceValue = this.getNodeStringValue(node, 'source');

          if (!isNonEmptyString(sourceValue)) {
            return;
          }

          const resolvedSource = this.resolvePath(filename, sourceValue);
          const specifiersValue = node.specifiers;
          const specifiers = asAnalyzerArray(specifiersValue);

          if (!specifiers) {
            return;
          }

          const names = specifiers
            .map(specValue => {
              const spec = this.asNode(specValue);

              if (!spec) {
                return null;
              }

              const local = this.asNode(spec.local);
              const exported = this.asNode(spec.exported);
              const localName = local ? this.getString(local, 'name') : null;
              const exportedName = exported ? this.getString(exported, 'name') : null;

              if (!isNonEmptyString(localName) || !isNonEmptyString(exportedName)) {
                return null;
              }

              return { local: localName, exported: exportedName };
            })
            .filter((value): value is ReExportName => value !== null);

          reExports.push({
            module: resolvedSource,
            exportAll: false,
            names,
          });

          return;
        }

        const declaration = this.asNode(node.declaration);

        if (declaration?.type === 'ClassDeclaration') {
          const declId = this.asNode(declaration.id);
          const name = declId ? this.getString(declId, 'name') : null;

          if (isNonEmptyString(name)) {
            localExports.push(name);
          }

          traverse(declaration);

          return;
        }

        if (declaration?.type === 'VariableDeclaration') {
          const declarationsValue = declaration.declarations;
          const declarations = asAnalyzerArray(declarationsValue);

          if (!declarations) {
            return;
          }

          for (const declValue of declarations) {
            const decl = this.asNode(declValue);
            const declId = decl ? this.asNode(decl.id) : null;
            const declName = declId ? this.getString(declId, 'name') : null;

            if (!isNonEmptyString(declName)) {
              continue;
            }

            if (decl?.init !== undefined) {
              const initValue = this.parseExpression(decl.init);

              localValues[declName] = initValue;
              exportedValues[declName] = initValue;
            }

            if (declName === 'module') {
              localExports.push('module');

              const init = decl ? this.asNode(decl.init) : null;

              if (init?.type === 'ObjectExpression') {
                moduleDefinition = this.extractModuleDefinition(init);
              }

              continue;
            }

            localExports.push(declName);
          }

          return;
        }

        const specifiersValue = node.specifiers;
        const specifiers = asAnalyzerArray(specifiersValue);

        if (specifiers) {
          for (const specValue of specifiers) {
            const spec = this.asNode(specValue);

            if (!spec) {
              continue;
            }

            const local = this.asNode(spec.local);
            const exported = this.asNode(spec.exported);
            const localName = local ? this.getString(local, 'name') : null;
            const exportedName = exported ? this.getString(exported, 'name') : null;

            if (!isNonEmptyString(localName) || !isNonEmptyString(exportedName)) {
              continue;
            }

            localExports.push(exportedName);

            if (Object.prototype.hasOwnProperty.call(localValues, localName)) {
              exportedValues[exportedName] = localValues[localName];
            }
          }
        }

        return;
      }

      if (node.type === 'VariableDeclaration') {
        const declarationsValue = node.declarations;
        const declarations = asAnalyzerArray(declarationsValue);

        if (!declarations) {
          return;
        }

        for (const declValue of declarations) {
          const decl = this.asNode(declValue);
          const declId = decl ? this.asNode(decl.id) : null;
          const declName = declId ? this.getString(declId, 'name') : null;

          if (!isNonEmptyString(declName)) {
            continue;
          }

          if (decl?.init !== undefined) {
            localValues[declName] = this.parseExpression(decl.init);
          }
        }

        return;
      }

      if (node.type === 'ClassDeclaration') {
        const classMeta = this.extractClassMetadata(node);

        classMeta.imports = { ...imports };

        classes.push(classMeta);

        return;
      }

      if (node.type === 'Program') {
        const bodyValue = node.body;
        const body = asAnalyzerArray(bodyValue);

        if (!body) {
          return;
        }

        for (const child of body) {
          traverse(child);
        }
      }
    };

    traverse(result.program);

    return {
      classes,
      reExports,
      exports: localExports,
      imports,
      importEntries,
      exportedValues,
      localValues,
      moduleDefinition,
    };
  }

  private extractModuleDefinition(node: NodeRecord): ModuleDefinition {
    let name: string | undefined;
    let nameDeclared = false;
    const providers: AnalyzerValue[] = [];
    let adapters: AnalyzerValue | undefined = undefined;
    const propertiesValue = node.properties;
    const properties = asAnalyzerArray(propertiesValue);

    if (properties) {
      for (const propValue of properties) {
        const prop = this.asNode(propValue);

        if (!prop) {
          continue;
        }

        const key = this.asNode(prop.key);
        const keyName = key ? this.getString(key, 'name') : null;

        if (!isNonEmptyString(keyName)) {
          continue;
        }

        if (keyName === 'name') {
          nameDeclared = true;

          const value = this.asNode(prop.value);

          if (value) {
            const literalValue = this.getString(value, 'value');

            if (isNonEmptyString(literalValue)) {
              name = literalValue;
            }
          }

          continue;
        }

        if (keyName === 'providers') {
          const value = this.asNode(prop.value);

          if (value?.type !== 'ArrayExpression') {
            continue;
          }

          const elementsValue = value.elements;
          const elements = asAnalyzerArray(elementsValue);

          if (!elements) {
            continue;
          }

          for (const elementValue of elements) {
            providers.push(this.parseExpression(elementValue));
          }

          continue;
        }

        if (keyName === 'adapters') {
          adapters = this.parseExpression(prop.value);
        }
      }
    }

    return {
      name,
      nameDeclared,
      providers,
      adapters,
      imports: { ...this.currentImports },
    };
  }

  private resolvePath(sourcePath: string, importPath: string): string {
    if (importPath.startsWith('.')) {
      const absolute = resolve(dirname(sourcePath), importPath);

      return absolute;
    }

    try {
      return Bun.resolveSync(importPath, dirname(sourcePath));
    } catch (_e) {
      return importPath;
    }
  }

  private resolveTypeValue(typeInfo: TypeInfo): AnalyzerValue {
    if (typeof typeInfo.typeName === 'string') {
      const importSource = this.currentImports[typeInfo.typeName];

      if (isNonEmptyString(importSource)) {
        return {
          __bunner_ref: typeInfo.typeName,
          __bunner_import_source: importSource,
        };
      }

      return typeInfo.typeName;
    }

    return typeInfo.typeName;
  }

  private extractClassMetadata(node: NodeRecord): ClassMetadata {
    const id = this.asNode(node.id);
    const className = id ? (this.getString(id, 'name') ?? 'Anonymous') : 'Anonymous';
    const decoratorsValue = node.decorators;
    const decoratorValues = asAnalyzerArray(decoratorsValue);
    const decorators = decoratorValues
      ? decoratorValues
          .map(value => this.extractDecorator(value))
          .filter((decorator): decorator is DecoratorMetadata => decorator !== null)
      : [];
    const constructorParams: ClassMetadata['constructorParams'] = [];
    const methods: ClassMetadata['methods'] = [];
    const properties: ClassMetadata['properties'] = [];
    let middlewares: ClassMetadata['middlewares'] = [];
    let errorFilters: ClassMetadata['errorFilters'] = [];
    const body = this.asNode(node.body);
    const bodyValue = body?.body;
    const bodyItems = asAnalyzerArray(bodyValue);

    if (bodyItems) {
      for (const memberValue of bodyItems) {
        const member = this.asNode(memberValue);

        if (!member) {
          continue;
        }

        if (member.type === 'MethodDefinition') {
          const kind = this.getString(member, 'kind');
          const value = this.asNode(member.value);
          const valueParamsValue = value?.params;
          const valueParams = asAnalyzerArray(valueParamsValue);
          const memberDecoratorsValue = member.decorators;

          if (kind === 'constructor') {
            if (valueParams) {
              for (const paramValue of valueParams) {
                const paramData = this.extractParam(paramValue);

                if (paramData) {
                  constructorParams.push(paramData);
                }
              }
            }

            continue;
          }

          if (kind === 'method') {
            const key = this.asNode(member.key);
            const methodName = key ? this.getString(key, 'name') : null;

            if (!isNonEmptyString(methodName)) {
              continue;
            }

            const methodDecoratorValues = asAnalyzerArray(memberDecoratorsValue);
            const methodDecorators = methodDecoratorValues
              ? methodDecoratorValues
                  .map(value => this.extractDecorator(value))
                  .filter((decorator): decorator is DecoratorMetadata => decorator !== null)
              : [];
            const methodParams: ClassMetadata['methods'][number]['parameters'] = [];

            if (valueParams) {
              for (let index = 0; index < valueParams.length; index += 1) {
                const param = this.extractParam(valueParams[index]);

                if (param) {
                  methodParams.push({
                    name: param.name,
                    type: param.type,
                    typeArgs: param.typeArgs,
                    decorators: param.decorators,
                    index,
                  });
                }
              }
            }

            methodParams.sort((a, b) => a.index - b.index);

            if (methodName === 'configure' && value) {
              middlewares = this.extractMiddlewaresFromConfigure(value);
              errorFilters = this.extractErrorFiltersFromConfigure(value);
            }

            if (methodDecorators.length > 0 || methodParams.some(param => param.decorators.length > 0)) {
              methods.push({
                name: methodName,
                decorators: methodDecorators,
                parameters: methodParams,
              });
            }

            continue;
          }

          continue;
        }

        if (member.type === 'PropertyDefinition') {
          const key = this.asNode(member.key);
          const propName = key ? this.getString(key, 'name') : null;

          if (!isNonEmptyString(propName)) {
            continue;
          }

          const memberDecoratorsValue = member.decorators;
          const decoratorValues = asAnalyzerArray(memberDecoratorsValue);
          const propDecorators = decoratorValues
            ? decoratorValues
                .map(value => this.extractDecorator(value))
                .filter((decorator): decorator is DecoratorMetadata => decorator !== null)
            : [];
          let typeInfo: TypeInfo = { typeName: 'any' };
          const typeAnnotation = this.asNode(member.typeAnnotation);
          const nestedTypeAnnotation = typeAnnotation ? this.asNode(typeAnnotation.typeAnnotation) : null;

          if (nestedTypeAnnotation) {
            typeInfo = this.typeResolver.resolve(nestedTypeAnnotation);
          }

          if (propDecorators.length > 0) {
            const optional = Boolean(member.optional) || this.getString(member, 'accessibility') === 'protected';

            properties.push({
              name: propName,
              type: this.resolveTypeValue(typeInfo),
              typeArgs: typeInfo.typeArgs,
              decorators: propDecorators,
              isOptional: optional,
              isArray: typeInfo.isArray,
              isEnum: typeInfo.isEnum,
              literals: typeInfo.literals,
              items: typeInfo.items ? this.resolveTypeValue(typeInfo.items) : undefined,
            });
          }
        }
      }
    }

    let heritage: ClassMetadata['heritage'] = undefined;
    const superClass = this.asNode(node.superClass);

    if (superClass) {
      if (superClass.type === 'Identifier') {
        heritage = {
          clause: 'extends',
          typeName: this.getString(superClass, 'name') ?? UNKNOWN_TYPE_NAME,
        };
      }

      if (superClass.type === 'TSTypeInstantiationExpression') {
        const expression = this.asNode(superClass.expression);
        const baseName =
          expression?.type === 'Identifier' ? (this.getString(expression, 'name') ?? UNKNOWN_TYPE_NAME) : UNKNOWN_TYPE_NAME;

        if (isNonEmptyString(baseName) && ['Partial', 'Pick', 'Omit', 'Required'].includes(baseName)) {
          const typeParameters = this.asNode(superClass.typeParameters);
          const params = typeParameters?.params;
          const typeArgs: string[] = [];
          const paramValues = asAnalyzerArray(params);

          if (paramValues) {
            for (const pValue of paramValues) {
              const p = this.asNode(pValue);

              if (!p) {
                typeArgs.push(UNKNOWN_TYPE_NAME);

                continue;
              }

              if (p.type === 'TSTypeReference') {
                const typeName = this.asNode(p.typeName);

                if (typeName?.type === 'Identifier') {
                  typeArgs.push(this.getString(typeName, 'name') ?? UNKNOWN_TYPE_NAME);

                  continue;
                }
              }

              typeArgs.push(UNKNOWN_TYPE_NAME);
            }
          }

          heritage = {
            clause: 'extends',
            typeName: baseName,
            typeArgs,
          };
        }
      }
    }

    const implementsValue = node.implements;
    const implementsList = asAnalyzerArray(implementsValue);
    const implementItems = implementsList ?? [];

    if (!heritage && implementItems.length > 0) {
      const impl = this.asNode(implementItems[0]);
      const expression = impl ? this.asNode(impl.expression) : null;
      const expressionName = expression?.type === 'Identifier' ? this.getString(expression, 'name') : null;

      if (isNonEmptyString(expressionName) && ['Partial', 'Pick', 'Omit'].includes(expressionName)) {
        const typeParameters = impl ? this.asNode(impl.typeParameters) : null;
        const params = typeParameters?.params;
        const typeArgs: string[] = [];
        const paramValues = asAnalyzerArray(params);

        if (paramValues) {
          for (const pValue of paramValues) {
            const p = this.asNode(pValue);

            if (!p) {
              typeArgs.push(UNKNOWN_TYPE_NAME);

              continue;
            }

            if (p.type === 'TSTypeReference') {
              const typeName = this.asNode(p.typeName);

              if (typeName?.type === 'Identifier') {
                typeArgs.push(this.getString(typeName, 'name') ?? UNKNOWN_TYPE_NAME);

                continue;
              }
            }

            typeArgs.push(UNKNOWN_TYPE_NAME);
          }
        }

        heritage = {
          clause: 'implements',
          typeName: expressionName,
          typeArgs,
        };
      }
    }

    return {
      className,
      heritage,
      decorators,
      constructorParams,
      methods,
      properties,
      imports: {},
      middlewares,
      errorFilters,
    };
  }

  private extractErrorFiltersFromConfigure(funcNode: NodeRecord): ClassMetadata['errorFilters'] {
    const errorFilters: ClassMetadata['errorFilters'] = [];

    const error = (): never => {
      throw new Error('[Bunner AOT] addErrorFilters는 리터럴 배열 + Identifier만 지원합니다.');
    };

    const visit = (n: AnalyzerValue): void => {
      const node = this.asNode(n);

      if (!node) {
        return;
      }

      if (node.type === 'CallExpression') {
        const callee = this.asNode(node.callee);
        const property = callee?.type === 'MemberExpression' ? this.asNode(callee.property) : null;
        const method = property ? this.getString(property, 'name') : null;

        if (method === 'addErrorFilters') {
          const args = asAnalyzerArray(node.arguments) ?? [];
          const arrayArg = args.length > 0 ? this.asNode(args[0]) : null;

          if (arrayArg?.type !== 'ArrayExpression') {
            error();

            return;
          }

          const elements = asAnalyzerArray(arrayArg.elements) ?? [];

          for (let index = 0; index < elements.length; index += 1) {
            const el = this.asNode(elements[index]);

            if (!el) {
              error();

              return;
            }

            if (el.type === 'SpreadElement') {
              error();

              return;
            }

            if (el.type === 'Identifier') {
              const name = this.getString(el, 'name');

              if (!isNonEmptyString(name)) {
                error();

                return;
              }

              errorFilters.push({ name, index });

              continue;
            }

            error();

            return;
          }

          return;
        }
      }

      Object.keys(node).forEach(key => {
        if (['type', 'loc', 'start', 'end'].includes(key)) {
          return;
        }

        const val = node[key];
        const values = asAnalyzerArray(val);

        if (values) {
          values.forEach(visit);

          return;
        }

        visit(val);
      });
    };

    visit(funcNode.body);

    return errorFilters;
  }

  private extractMiddlewaresFromConfigure(funcNode: NodeRecord): ClassMetadata['middlewares'] {
    const middlewares: ClassMetadata['middlewares'] = [];

    const error = (): never => {
      throw new Error('[Bunner AOT] addMiddlewares는 리터럴 배열 + Identifier/withOptions만 지원합니다.');
    };

    const visit = (n: AnalyzerValue): void => {
      const node = this.asNode(n);

      if (!node) {
        return;
      }

      if (node.type === 'CallExpression') {
        const callee = this.asNode(node.callee);
        const property = callee?.type === 'MemberExpression' ? this.asNode(callee.property) : null;
        const method = property ? this.getString(property, 'name') : null;

        if (method === 'addMiddlewares') {
          const argsValue = asAnalyzerArray(node.arguments);
          const args = argsValue ?? [];
          const lifecycleArg = args.length > 0 ? this.asNode(args[0]) : null;
          const lifecycle = lifecycleArg?.type === 'Identifier' ? (this.getString(lifecycleArg, 'name') ?? undefined) : undefined;
          const arrayArg = args.length > 1 ? this.asNode(args[1]) : null;

          if (arrayArg?.type !== 'ArrayExpression') {
            error();

            return;
          }

          const elementsValue = arrayArg.elements;
          const elements = asAnalyzerArray(elementsValue) ?? [];

          for (let index = 0; index < elements.length; index += 1) {
            const el = this.asNode(elements[index]);

            if (!el) {
              error();

              return;
            }

            if (el.type === 'SpreadElement') {
              error();

              return;
            }

            if (el.type === 'Identifier') {
              const name = this.getString(el, 'name');

              if (!isNonEmptyString(name)) {
                error();

                return;
              }

              if (isNonEmptyString(lifecycle)) {
                middlewares.push({ name, lifecycle, index });

                continue;
              }

              middlewares.push({ name, index });

              continue;
            }

            if (el.type === 'CallExpression') {
              const innerCallee = this.asNode(el.callee);
              const innerObject = innerCallee?.type === 'MemberExpression' ? this.asNode(innerCallee.object) : null;
              const innerProperty = innerCallee?.type === 'MemberExpression' ? this.asNode(innerCallee.property) : null;
              const propName = innerProperty ? this.getString(innerProperty, 'name') : null;

              if (innerObject?.type === 'Identifier' && propName === 'withOptions') {
                const name = this.getString(innerObject, 'name');

                if (!isNonEmptyString(name)) {
                  error();

                  return;
                }

                if (isNonEmptyString(lifecycle)) {
                  middlewares.push({ name, lifecycle, index });

                  continue;
                }

                middlewares.push({ name, index });

                continue;
              }
            }

            error();

            return;
          }

          return;
        }
      }

      Object.keys(node).forEach(key => {
        if (['type', 'loc', 'start', 'end'].includes(key)) {
          return;
        }

        const val = node[key];
        const values = asAnalyzerArray(val);

        if (values) {
          values.forEach(visit);

          return;
        }

        visit(val);
      });
    };

    visit(funcNode.body);

    return middlewares;
  }

  private extractDecorator(decoratorNodeValue: AnalyzerValue): DecoratorMetadata | null {
    let name = '';
    let args: AnalyzerValue[] = [];
    const decoratorNode = this.asNode(decoratorNodeValue);

    if (!decoratorNode) {
      return null;
    }

    const expression = this.asNode(decoratorNode.expression);

    if (!expression) {
      return null;
    }

    if (expression.type === 'CallExpression') {
      const callee = this.asNode(expression.callee);
      const calleeName = callee ? this.getString(callee, 'name') : null;

      if (!isNonEmptyString(calleeName)) {
        return null;
      }

      name = calleeName;

      const argsValue = asAnalyzerArray(expression.arguments);
      const argsList = argsValue ?? [];

      args = argsList.map(arg => this.parseExpression(arg));
    } else if (expression.type === 'Identifier') {
      const calleeName = this.getString(expression, 'name');

      if (!isNonEmptyString(calleeName)) {
        return null;
      }

      name = calleeName;
    }

    return { name, arguments: args };
  }

  private parseExpression(exprValue: AnalyzerValue): AnalyzerValue {
    if (isNullish(exprValue)) {
      return null;
    }

    const raw = this.asNode(exprValue);

    if (!raw) {
      return null;
    }

    const expr = raw.type === 'ExpressionStatement' ? this.asNode(raw.expression) : raw;

    if (!expr) {
      return null;
    }

    switch (expr.type) {
      case 'Literal':
      case 'StringLiteral':
      case 'NumericLiteral':
      case 'BooleanLiteral':
      case 'NullLiteral':
        return this.getRecord(expr)?.value ?? null;

      case 'ObjectExpression': {
        const obj: AnalyzerValueRecord = {};
        const propertiesValue = expr.properties;
        const properties = asAnalyzerArray(propertiesValue) ?? [];

        for (const propValue of properties) {
          const prop = this.asNode(propValue);

          if (!prop) {
            continue;
          }

          if (prop.type !== 'Property' && prop.type !== 'ObjectProperty') {
            continue;
          }

          if (prop.computed === true) {
            const keyExpr = this.parseExpression(prop.key);
            const valExpr = this.parseExpression(prop.value);
            const start = typeof prop.start === 'number' ? prop.start : 0;

            obj[`__bunner_computed_${start}`] = {
              __bunner_computed_key: keyExpr,
              __bunner_computed_value: valExpr,
            };

            continue;
          }

          const keyNode = this.asNode(prop.key);
          const keyName = keyNode ? this.getString(keyNode, 'name') : null;
          const keyValue = keyNode ? this.getString(keyNode, 'value') : null;
          const key = keyName ?? keyValue;

          if (!isNonEmptyString(key)) {
            continue;
          }

          obj[key] = this.parseExpression(prop.value);
        }

        return obj;
      }

      case 'ArrayExpression': {
        const elementsValue = expr.elements;
        const elements = asAnalyzerArray(elementsValue) ?? [];

        return elements.map(elValue => {
          const el = this.asNode(elValue);

          if (el?.type === 'SpreadElement') {
            return { __bunner_spread: this.parseExpression(el.argument) };
          }

          return this.parseExpression(elValue);
        });
      }

      case 'Identifier': {
        const name = this.getString(expr, 'name');

        if (!isNonEmptyString(name)) {
          return null;
        }

        const importSource = this.currentImports[name];

        return {
          __bunner_ref: name,
          __bunner_import_source: importSource,
        };
      }

      case 'NewExpression': {
        const callee = this.asNode(expr.callee);

        if (!callee) {
          return null;
        }

        const argsValue = asAnalyzerArray(expr.arguments);
        const args = argsValue ?? [];

        return {
          __bunner_new: this.getString(callee, 'name') ?? UNKNOWN_TYPE_NAME,
          args: args.map(arg => this.parseExpression(arg)),
        };
      }

      case 'CallExpression': {
        let calleeName = UNKNOWN_CALLEE_NAME;
        let importSource: string | undefined;
        const callee = this.asNode(expr.callee);

        if (callee?.type === 'MemberExpression') {
          const calleeObj = this.asNode(callee.object);
          const calleeProp = this.asNode(callee.property);
          const objectName = calleeObj?.type === 'Identifier' ? this.getString(calleeObj, 'name') : null;
          const propName = calleeProp ? this.getString(calleeProp, 'name') : null;

          if (isNonEmptyString(objectName) && isNonEmptyString(propName)) {
            calleeName = `${objectName}.${propName}`;
            importSource = this.currentImports[objectName];
          }
        } else if (callee?.type === 'Identifier') {
          const name = this.getString(callee, 'name');

          if (isNonEmptyString(name)) {
            calleeName = name;
            importSource = this.currentImports[name];
          }
        }

        const argsValue = asAnalyzerArray(expr.arguments);
        const args = argsValue ?? [];

        if (calleeName === 'forwardRef' && args.length > 0) {
          const arg = this.asNode(args[0]);
          const argBody = arg ? this.asNode(arg.body) : null;

          if ((arg?.type === 'ArrowFunctionExpression' || arg?.type === 'FunctionExpression') && argBody?.type === 'Identifier') {
            const refName = this.getString(argBody, 'name');

            if (isNonEmptyString(refName)) {
              return { __bunner_forward_ref: refName };
            }
          }
        }

        return {
          __bunner_call: calleeName,
          __bunner_import_source: importSource,
          args: args.map(arg => this.parseExpression(arg)),
        };
      }

      case 'ArrowFunctionExpression':
      case 'FunctionExpression': {
        const start = typeof expr.start === 'number' ? expr.start : 0;
        const end = typeof expr.end === 'number' ? expr.end : start;
        const factoryCode = this.currentCode.slice(start, end);
        const deps = this.extractDependencies(expr, start);

        return { __bunner_factory_code: factoryCode, __bunner_factory_deps: deps };
      }

      case 'SpreadElement':
        return { __bunner_spread: this.parseExpression(expr.argument) };

      default:
        return null;
    }
  }

  private extractDependencies(funcNode: NodeRecord, offset: number): FactoryDependency[] {
    const deps: FactoryDependency[] = [];
    const defined = new Set<string>();

    const visit = (n: AnalyzerValue): void => {
      const node = this.asNode(n);

      if (!node) {
        return;
      }

      if (node.type === 'Identifier') {
        const name = this.getString(node, 'name');
        const start = typeof node.start === 'number' ? node.start : null;
        const end = typeof node.end === 'number' ? node.end : null;
        const path = isNonEmptyString(name) ? this.currentImports[name] : undefined;

        if (isNonEmptyString(name) && isNonEmptyString(path) && start !== null && end !== null && !defined.has(name)) {
          deps.push({
            name,
            path,
            start: start - offset,
            end: end - offset,
          });
        }
      }

      if (node.type === 'FunctionExpression') {
        const params = asAnalyzerArray(node.params);

        if (params) {
          for (const pValue of params) {
            const p = this.asNode(pValue);

            if (p?.type === 'Identifier') {
              const name = this.getString(p, 'name');

              if (isNonEmptyString(name)) {
                defined.add(name);
              }
            }
          }
        }

        visit(node.body);

        return;
      }

      Object.keys(node).forEach(key => {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') {
          return;
        }

        const val = node[key];

        if (Array.isArray(val)) {
          val.forEach(visit);
        } else {
          visit(val);
        }
      });
    };

    visit(funcNode.body);

    return deps;
  }

  private extractParam(paramNodeValue: AnalyzerValue): ExtractedParam | null {
    const paramNode = this.asNode(paramNodeValue);

    if (!paramNode) {
      return null;
    }

    if (paramNode.type === 'TSParameterProperty') {
      const param = this.extractParam(paramNode.parameter);

      if (!param) {
        return null;
      }

      const decoratorsValue = paramNode.decorators;
      const parentDecoratorValues = asAnalyzerArray(decoratorsValue);
      const parentDecorators = parentDecoratorValues
        ? parentDecoratorValues
            .map(value => this.extractDecorator(value))
            .filter((decorator): decorator is DecoratorMetadata => decorator !== null)
        : [];
      const nextDecorators = [...parentDecorators, ...param.decorators];

      return {
        name: param.name,
        type: param.type,
        typeArgs: param.typeArgs,
        decorators: nextDecorators,
      };
    }

    if (paramNode.type === 'AssignmentPattern') {
      const node = paramNode.type === 'AssignmentPattern' ? this.asNode(paramNode.left) : paramNode;

      if (node?.type !== 'Identifier') {
        return null;
      }

      const name = this.getString(node, 'name');

      if (!isNonEmptyString(name)) {
        return null;
      }

      const decoratorsValue = paramNode.decorators;
      const decoratorValues = asAnalyzerArray(decoratorsValue);
      const decorators = decoratorValues
        ? decoratorValues
            .map(value => this.extractDecorator(value))
            .filter((decorator): decorator is DecoratorMetadata => decorator !== null)
        : [];
      let typeInfo: TypeInfo = { typeName: 'any' };
      const typeAnnotation = this.asNode(node.typeAnnotation);
      const nestedTypeAnnotation = typeAnnotation ? this.asNode(typeAnnotation.typeAnnotation) : null;

      if (nestedTypeAnnotation) {
        typeInfo = this.typeResolver.resolve(nestedTypeAnnotation);
      }

      const typeValue = this.resolveTypeValue(typeInfo);

      return {
        name,
        type: typeValue,
        typeArgs: typeInfo.typeArgs,
        decorators,
      };
    }

    return null;
  }

  private asNode(value: AnalyzerValue): NodeRecord | null {
    const record = this.getRecord(value);

    if (!record) {
      return null;
    }

    if (!isNodeRecord(record)) {
      return null;
    }

    return record;
  }

  private getRecord(value: AnalyzerValue): AnalyzerValueRecord | null {
    if (!isAnalyzerRecord(value)) {
      return null;
    }

    return value;
  }

  private getString(node: AnalyzerValueRecord, key: string): string | null {
    const value = node[key];

    if (typeof value !== 'string') {
      return null;
    }

    return value;
  }

  private getNodeStringValue(node: AnalyzerValueRecord, key: string): string | null {
    const child = this.asNode(node[key]);

    if (!child) {
      return null;
    }

    return this.getString(child, 'value');
  }
}
