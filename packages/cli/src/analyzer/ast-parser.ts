import { parseSync } from 'oxc-parser';

import type { ClassMetadata, DecoratorMetadata } from './structure/metadata.structure';
import { TypeResolver, type TypeInfo } from './type-resolver/type-resolver';

export type { ClassMetadata, DecoratorMetadata };

export class AstParser {
  private currentCode: string = '';
  private typeResolver = new TypeResolver();

  parse(filename: string, code: string): ClassMetadata[] {
    this.currentCode = code;
    const result = parseSync(filename, code);
    const classes: ClassMetadata[] = [];
    const imports: Record<string, string> = {};

    const traverse = (node: any) => {
      // Handle ImportDeclaration
      if (node.type === 'ImportDeclaration') {
        const source = node.source.value;
        (node.specifiers || []).forEach((spec: any) => {
          imports[spec.local.name] = source;
        });
      }

      // Handle ExportNamedDeclaration containing ClassDeclaration
      if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        traverse(node.declaration);
        return;
      }

      if (node.type === 'ClassDeclaration') {
        const classMeta = this.extractClassMetadata(node);
        classMeta.imports = { ...imports };
        classes.push(classMeta);
      }

      // Check for children if Program or nested
      if (node.type === 'Program' && node.body) {
        node.body.forEach(traverse);
      }
    };

    traverse(result.program);
    return classes;
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
          // Constructor
          member.value.params.forEach((param: any) => {
            const paramData = this.extractParam(param);
            if (paramData) {
              constructorParams.push(paramData);
            }
          });
        } else if (member.kind === 'method') {
          // Method
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
        // Property
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

    return {
      className,
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
          if (prop.type === 'Property') {
            const key = prop.key.name || prop.key.value;
            obj[key] = this.parseExpression(prop.value);
          }
        });
        return obj;
      }

      case 'ArrayExpression':
        return (node.elements || []).map((el: any) => this.parseExpression(el));

      case 'Identifier':
        return { __bunner_ref: node.name };

      case 'NewExpression':
        return {
          __bunner_new: node.callee.name,
          args: (node.arguments || []).map((arg: any) => this.parseExpression(arg)),
        };

      case 'CallExpression': {
        let calleeName = 'unknown';
        if (node.callee.type === 'MemberExpression') {
          calleeName = `${node.callee.object.name}.${node.callee.property.name}`;
        } else if (node.callee.type === 'Identifier') {
          calleeName = node.callee.name;
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
          args: (node.arguments || []).map((arg: any) => this.parseExpression(arg)),
        };
      }

      case 'ArrowFunctionExpression':
      case 'FunctionExpression': {
        const start = node.start;
        const end = node.end;
        const factoryCode = this.currentCode.slice(start, end);
        return { __bunner_factory_code: factoryCode };
      }

      default:
        return null;
    }
  }

  private extractParam(paramNode: any): any {
    if (paramNode.type === 'TSParameterProperty') {
      return this.extractParam(paramNode.parameter);
    }

    if (paramNode.type === 'Identifier' || paramNode.type === 'AssignmentPattern') {
      const node = paramNode.type === 'AssignmentPattern' ? paramNode.left : paramNode;
      const name = node.name;
      const decorators = (paramNode.decorators || []).map((d: any) => this.extractDecorator(d));

      let typeInfo: TypeInfo = { typeName: 'any', typeArgs: undefined };
      if (node.typeAnnotation && node.typeAnnotation.typeAnnotation) {
        typeInfo = this.typeResolver.resolve(node.typeAnnotation.typeAnnotation);
      }

      return {
        name,
        type: typeInfo.typeName,
        typeArgs: typeInfo.typeArgs,
        decorators,
      };
    }
    return null;
  }
}
