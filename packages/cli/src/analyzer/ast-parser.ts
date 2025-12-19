import { parseSync } from 'oxc-parser';

export interface DecoratorMetadata {
  name: string;
  arguments: any[];
}

export interface ClassMetadata {
  className: string;
  decorators: DecoratorMetadata[];
  constructorParams: {
    name: string;
    type: string;
    decorators: DecoratorMetadata[];
  }[];
  methods: {
    name: string;
    decorators: DecoratorMetadata[];
    parameters: {
      name: string;
      type: string;
      decorators: DecoratorMetadata[];
      index: number;
    }[];
  }[];
  properties: {
    name: string;
    type: string;
    decorators: DecoratorMetadata[];
  }[];
  imports: Record<string, string>; // Identifier -> Source Path
}

export class AstParser {
  private currentCode: string = '';

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
          // local.name is what we use in code
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
        classMeta.imports = { ...imports }; // Attach imports available in this file scope
        classes.push(classMeta);
      }

      // Check for children if Program or other block
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
          member.value.params.forEach((param: any) => {
            const paramData = this.extractParam(param);
            if (paramData) {
              constructorParams.push(paramData);
            }
          });
        } else if (member.kind === 'method') {
          // Extract Method Metadata
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
        // Type?
        let propType = 'any';
        if (member.typeAnnotation && member.typeAnnotation.typeAnnotation) {
          // Simplified type extraction
          const t = member.typeAnnotation.typeAnnotation;
          if (t.type === 'TSTypeReference' && t.typeName.type === 'Identifier') {
            propType = t.typeName.name;
          }
        }

        if (propDecorators.length > 0) {
          properties.push({
            name: propName,
            type: propType,
            decorators: propDecorators,
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
      imports: {}, // Will be populated by traverse
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

    // OXC AST normalization
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
        // Tag as reference to handle later in Codegen (e.g. for @Inject(Token))
        return { __bunner_ref: node.name };

      case 'NewExpression':
        return {
          __bunner_new: node.callee.name,
          args: (node.arguments || []).map((arg: any) => this.parseExpression(arg)),
        };

      case 'CallExpression': {
        // Dynamic Module Call (e.g. ConfigModule.forRoot()) OR forwardRef()
        // We need to capture the callee name (e.g. "ConfigModule.forRoot" or just "forRoot")
        // Note: callee might be MemberExpression
        let calleeName = 'unknown';
        if (node.callee.type === 'MemberExpression') {
          calleeName = `${node.callee.object.name}.${node.callee.property.name}`;
        } else if (node.callee.type === 'Identifier') {
          calleeName = node.callee.name;
        }

        // Handle forwardRef(() => Module)
        if (calleeName === 'forwardRef' && node.arguments.length > 0) {
          const arg = node.arguments[0];
          // Expect ArrowFunctionExpression or FunctionExpression
          if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
            // Extract the return value identifier from the function body
            // e.g. () => ModuleName
            if (arg.body.type === 'Identifier') {
              return { __bunner_forward_ref: arg.body.name };
            }
            // BlockStatement? { return ModuleName; }
          }
        }

        return {
          __bunner_call: calleeName,
          args: (node.arguments || []).map((arg: any) => this.parseExpression(arg)),
        };
      }

      // Handle ArrowFunctionExpression for useFactory or other async configs if needed simply
      case 'ArrowFunctionExpression':
      case 'FunctionExpression': {
        const start = node.start;
        const end = node.end;
        const factoryCode = this.currentCode.slice(start, end);
        return { __bunner_factory_code: factoryCode };
      }

      default:
        // Fallback or unsupported
        return null;
    }
  }

  private extractParam(paramNode: any): any {
    if (paramNode.type === 'TSParameterProperty') {
      return this.extractParam(paramNode.parameter);
    }

    // Handle Identifier or AssignmentPattern (default value)
    if (paramNode.type === 'Identifier' || paramNode.type === 'AssignmentPattern') {
      const node = paramNode.type === 'AssignmentPattern' ? paramNode.left : paramNode;
      const name = node.name;
      let type = 'any';
      const decorators = (paramNode.decorators || []).map((d: any) => this.extractDecorator(d));

      if (node.typeAnnotation && node.typeAnnotation.typeAnnotation) {
        const typeNode = node.typeAnnotation.typeAnnotation;
        if (typeNode.type === 'TSTypeReference' && typeNode.typeName.type === 'Identifier') {
          type = typeNode.typeName.name;
        } else if (typeNode.type === 'TSStringKeyword') {
          type = 'string';
        } else if (typeNode.type === 'TSNumberKeyword') {
          type = 'number';
        } else if (typeNode.type === 'TSBooleanKeyword') {
          type = 'boolean';
        }
      }

      return { name, type, decorators };
    }
    return null;
  }
}
