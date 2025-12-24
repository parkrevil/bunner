import { dirname, resolve } from 'path';

import { parseSync } from 'oxc-parser';

import { AstTypeResolver, type TypeInfo } from './ast-type-resolver';
import type { ClassMetadata, DecoratorMetadata } from './interfaces';
import type { ParseResult, ReExport } from './parser-models';

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
    this.currentImports = {};

    const traverse = (node: any) => {
      // 1. Imports
      if (node.type === 'ImportDeclaration') {
        // Skip import type ...
        if (node.importKind === 'type') {
          return;
        }

        const source = node.source.value;
        const resolvedSource = this.resolvePath(filename, source);
        (node.specifiers || []).forEach((spec: any) => {
          // Skip import { type Foo } ...
          if (spec.importKind === 'type') {
            return;
          }
          imports[spec.local.name] = resolvedSource;
          this.currentImports[spec.local.name] = resolvedSource;
        });
      }

      // 2. Export All (export * from '...')
      if (node.type === 'ExportAllDeclaration') {
        const source = node.source.value;
        const resolvedSource = this.resolvePath(filename, source);
        reExports.push({
          module: resolvedSource,
          exportAll: true,
        });
      }

      // 3. Export Named (export { A } from '...' or export class ...)
      if (node.type === 'ExportNamedDeclaration') {
        if (node.source) {
          // Re-export: export { A } from './a'
          const source = node.source.value;
          const resolvedSource = this.resolvePath(filename, source);
          const names = (node.specifiers || []).map((spec: any) => ({
            local: spec.local.name,
            exported: spec.exported.name,
          }));
          reExports.push({
            module: resolvedSource,
            exportAll: false,
            names,
          });
        } else if (node.declaration) {
          // Local export: export class Foo ...
          if (node.declaration.type === 'ClassDeclaration') {
            localExports.push(node.declaration.id.name);
            // Traverse into class to extract metadata
            traverse(node.declaration);
            return; // Don't traverse specific children again if handled
          }
          // Handle other declarations if needed (funcs, vars)
        }
      }

      // 4. Class Declaration (captured even if not exported, but we track export status)
      if (node.type === 'ClassDeclaration') {
        const classMeta = this.extractClassMetadata(node);
        classMeta.imports = { ...imports };
        classes.push(classMeta);
      }

      if (node.type === 'Program' && node.body) {
        node.body.forEach(traverse);
      }
    };

    traverse(result.program);
    return { classes, reExports, exports: localExports, imports };
  }

  private resolvePath(sourcePath: string, importPath: string): string {
    if (importPath.startsWith('.')) {
      // Resolve to absolute
      const absolute = resolve(dirname(sourcePath), importPath);
      return absolute;
    }
    // Package import
    try {
      // Resolve package to absolute path, relative to the source file
      return Bun.resolveSync(importPath, dirname(sourcePath));
    } catch (_e) {
      // Fallback or built-ins
      return importPath;
    }
  }

  private extractClassMetadata(node: any): ClassMetadata {
    const className = node.id.name;
    const decorators = (node.decorators || []).map((d: any) => this.extractDecorator(d));
    const constructorParams: ClassMetadata['constructorParams'] = [];
    const methods: ClassMetadata['methods'] = [];
    const properties: ClassMetadata['properties'] = [];

    node.body.body.forEach((member: any) => {
      if (member.type === 'MethodDefinition') {
        if (member.kind === 'constructor') {
          member.value.params.forEach((param: any) => {
            const paramData = this.extractParam(param);
            if (paramData) {
              constructorParams.push(paramData);
            }
          });
        } else if (member.kind === 'method') {
          const methodName = member.key.name;
          const methodDecorators = (member.decorators || []).map((d: any) => this.extractDecorator(d));
          const methodParams: any[] = [];

          member.value.params.forEach((param: any, index: number) => {
            const p = this.extractParam(param);
            if (p) {
              methodParams.push({ ...p, index });
            }
          });

          if (methodDecorators.length > 0 || methodParams.some(p => p.decorators.length > 0)) {
            methods.push({
              name: methodName,
              decorators: methodDecorators,
              parameters: methodParams,
            });
          }
        }
      } else if (member.type === 'PropertyDefinition') {
        const propName = member.key.name;
        const propDecorators = (member.decorators || []).map((d: any) => this.extractDecorator(d));

        let typeInfo: TypeInfo = { typeName: 'any', typeArgs: undefined };
        if (member.typeAnnotation && member.typeAnnotation.typeAnnotation) {
          typeInfo = this.typeResolver.resolve(member.typeAnnotation.typeAnnotation);
        }

        if (propDecorators.length > 0) {
          properties.push({
            name: propName,
            type: typeInfo.typeName,
            typeArgs: typeInfo.typeArgs,
            decorators: propDecorators,
            isOptional: member.optional || member.accessibility === 'protected' || false, // Handling optionality
            isArray: typeInfo.isArray,
            isEnum: typeInfo.isEnum,
            literals: typeInfo.literals,
            items: typeInfo.items,
          });
        }
      }
    });

    // Heritage (Extends/Implements)
    let heritage: ClassMetadata['heritage'] = undefined;

    // 1. extends Clause
    if (node.superClass) {
      // Direct extension: extends BaseClass
      if (node.superClass.type === 'Identifier') {
        heritage = {
          clause: 'extends',
          typeName: node.superClass.name,
        };
      } else if (
        node.superClass.type === 'CallExpression' ||
        node.superClass.type === 'TSTypeInstantiationExpression' ||
        (node.superClass.typeName && node.superClass.typeName.name === 'Partial')
      ) {
        // Note: Oxc parser might parse `Partial<Dto>` as TSTypeInstantiationExpression
        // or CallExpression if it looks like func call (but <...> is TypeInstantiation)

        if (node.superClass.type === 'TSTypeInstantiationExpression') {
          const baseName = node.superClass.expression.type === 'Identifier' ? node.superClass.expression.name : 'Unknown';
          if (['Partial', 'Pick', 'Omit', 'Required'].includes(baseName)) {
            const typeArgs = node.superClass.typeParameters.params.map((p: any) => {
              // Simple resolution for Identifier types as args
              if (p.type === 'TSTypeReference' && p.typeName.type === 'Identifier') {
                return p.typeName.name;
              }
              return 'Unknown';
            });

            heritage = {
              clause: 'extends',
              typeName: baseName,
              typeArgs,
            };
          }
        }
      }
    }

    // 2. implements Clause (if extends is not mapped type, check implements)
    if (!heritage && node.implements && node.implements.length > 0) {
      // Only process the first significant one for DTO mapping for now
      const impl = node.implements[0]; // TSClassImplements

      // implements Partial<Dto>
      if (impl.expression.type === 'Identifier' && ['Partial', 'Pick', 'Omit'].includes(impl.expression.name)) {
        const typeArgs = impl.typeParameters
          ? impl.typeParameters.params.map((p: any) => {
              if (p.type === 'TSTypeReference' && p.typeName.type === 'Identifier') {
                return p.typeName.name;
              }
              return 'Unknown';
            })
          : [];

        heritage = {
          clause: 'implements',
          typeName: impl.expression.name,
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
    };
  }

  private extractDecorator(decoratorNode: any): DecoratorMetadata {
    let name = '';
    let args: any[] = [];

    if (decoratorNode.expression.type === 'CallExpression') {
      name = decoratorNode.expression.callee.name;
      args = decoratorNode.expression.arguments.map((arg: any) => this.parseExpression(arg));
    } else if (decoratorNode.expression.type === 'Identifier') {
      name = decoratorNode.expression.name;
    }

    return { name, arguments: args };
  }

  private parseExpression(expr: any): any {
    if (!expr) {
      return null;
    }

    const node = expr.type === 'ExpressionStatement' ? expr.expression : expr;

    switch (node.type) {
      case 'Literal':
      case 'StringLiteral':
      case 'NumericLiteral':
      case 'BooleanLiteral':
      case 'NullLiteral':
        return node.value;

      case 'ObjectExpression': {
        const obj: any = {};
        (node.properties || []).forEach((prop: any) => {
          if (prop.type === 'Property' || prop.type === 'ObjectProperty') {
            const key = prop.key.name || prop.key.value;
            obj[key] = this.parseExpression(prop.value);
          }
        });
        return obj;
      }

      case 'ArrayExpression':
        return (node.elements || []).map((el: any) => this.parseExpression(el));

      case 'Identifier': {
        const importSource = this.currentImports[node.name];
        return {
          __bunner_ref: node.name,
          __bunner_import_source: importSource,
        };
      }

      case 'NewExpression':
        return {
          __bunner_new: node.callee.name,
          args: (node.arguments || []).map((arg: any) => this.parseExpression(arg)),
        };

      case 'CallExpression': {
        let calleeName = 'unknown';
        let importSource: string | undefined;
        if (node.callee.type === 'MemberExpression') {
          calleeName = `${node.callee.object.name}.${node.callee.property.name}`;
          if (node.callee.object.type === 'Identifier') {
            importSource = this.currentImports[node.callee.object.name];
          }
        } else if (node.callee.type === 'Identifier') {
          calleeName = node.callee.name;
          importSource = this.currentImports[calleeName];
        }

        // Handle forwardRef(() => Module)
        if (calleeName === 'forwardRef' && node.arguments.length > 0) {
          const arg = node.arguments[0];
          if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
            if (arg.body.type === 'Identifier') {
              return { __bunner_forward_ref: arg.body.name };
            }
          }
        }

        return {
          __bunner_call: calleeName,
          __bunner_import_source: importSource,
          args: (node.arguments || []).map((arg: any) => this.parseExpression(arg)),
        };
      }

      case 'ArrowFunctionExpression':
      case 'FunctionExpression': {
        const start = node.start;
        const end = node.end;
        const factoryCode = this.currentCode.slice(start, end);

        const deps = this.extractDependencies(node, start);
        return { __bunner_factory_code: factoryCode, __bunner_factory_deps: deps };
      }

      default:
        return null;
    }
  }

  private extractDependencies(funcNode: any, offset: number): any[] {
    const deps: any[] = [];
    const defined = new Set<string>();

    // Recursively find identifiers
    const visit = (n: any) => {
      if (!n || typeof n !== 'object') {
        return;
      }

      if (n.type === 'Identifier') {
        // Check if it's a known import and not shadowed
        if (this.currentImports[n.name] && !defined.has(n.name)) {
          // It's an external dependency!
          // We need its position relative to the factory start to replace it later if needed?
          // Actually, injector needs absolute position or relative to factory string.
          // factoryCode starts at `start`. Identifier is at `n.start`.
          // Relative start = n.start - offset.
          deps.push({
            name: n.name,
            path: this.currentImports[n.name],
            start: n.start - offset,
            end: n.end - offset,
          });
        }
      }

      // Scope tracking (Simplified - assumes no shadowing for now to save complexity,
      // as usually middleware calls are simple)
      // Ideally we track params and var decls.
      if (n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression') {
        n.params.forEach((p: any) => {
          if (p.type === 'Identifier') {
            defined.add(p.name);
          }
        });
        // Traverse body
        visit(n.body);
        return; // Don't traverse keys of function again
      }

      // Traverse children
      Object.keys(n).forEach(key => {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') {
          return;
        }
        const val = n[key];
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

  private extractParam(paramNode: any): any {
    if (paramNode.type === 'TSParameterProperty') {
      const param = this.extractParam(paramNode.parameter);
      if (param) {
        // Merge decorators from TSParameterProperty (parent)
        const parentDecorators = (paramNode.decorators || []).map((d: any) => this.extractDecorator(d));
        param.decorators = [...parentDecorators, ...param.decorators];
      }
      return param;
    }

    if (paramNode.type === 'Identifier' || paramNode.type === 'AssignmentPattern') {
      const node = paramNode.type === 'AssignmentPattern' ? paramNode.left : paramNode;
      const name = node.name;
      const decorators = (paramNode.decorators || []).map((d: any) => this.extractDecorator(d));

      let typeInfo: TypeInfo = { typeName: 'any', typeArgs: undefined };
      if (node.typeAnnotation && node.typeAnnotation.typeAnnotation) {
        typeInfo = this.typeResolver.resolve(node.typeAnnotation.typeAnnotation);
      }

      let typeValue: any = typeInfo.typeName;
      if (typeof typeInfo.typeName === 'string' && this.currentImports[typeInfo.typeName]) {
        typeValue = {
          __bunner_ref: typeInfo.typeName,
          __bunner_import_source: this.currentImports[typeInfo.typeName],
        };
      }

      return {
        name,
        type: typeValue,
        typeArgs: typeInfo.typeArgs,
        decorators,
      };
    }
    return null;
  }
}
