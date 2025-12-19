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
}

export class AstParser {
  parse(filename: string, code: string): ClassMetadata[] {
    const result = parseSync(filename, code);
    const classes: ClassMetadata[] = [];

    const traverse = (node: any) => {
      // Handle ExportNamedDeclaration containing ClassDeclaration
      if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        traverse(node.declaration);
        return;
      }

      if (node.type === 'ClassDeclaration') {
        classes.push(this.extractClassMetadata(node));
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
    };
  }

  private extractDecorator(decoratorNode: any): DecoratorMetadata {
    let name = '';
    let args: any[] = [];

    if (decoratorNode.expression.type === 'CallExpression') {
      name = decoratorNode.expression.callee.name;
      // Simplified arg extraction (literals only for now)
      args = decoratorNode.expression.arguments.map((arg: any) => {
        if (arg.type === 'Literal') {
          return arg.value;
        }
        // TODO: ObjectExpression support for configs
        return null;
      });
    } else if (decoratorNode.expression.type === 'Identifier') {
      name = decoratorNode.expression.name;
    }

    return { name, arguments: args };
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
