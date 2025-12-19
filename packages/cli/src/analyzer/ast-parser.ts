import { parseSync } from 'oxc-parser';

export interface ClassMetadata {
  className: string;
  constructorParams: {
    name: string;
    type: string;
    decorators: string[];
  }[];
  decorators: {
    name: string;
    arguments: any[];
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

    const constructorMethod = node.body.body.find((m: any) => m.type === 'MethodDefinition' && m.kind === 'constructor');

    if (constructorMethod) {
      constructorMethod.value.params.forEach((param: any) => {
        const paramData = this.extractParam(param);
        if (paramData) {
          constructorParams.push(paramData);
        }
      });
    }

    return {
      className,
      constructorParams,
      decorators,
    };
  }

  private extractDecorator(decoratorNode: any) {
    // Handling @Decorator() or @Decorator
    let name = '';
    let args: any[] = [];

    if (decoratorNode.expression.type === 'CallExpression') {
      name = decoratorNode.expression.callee.name;
      // Simplified arg extraction (literals only for now)
      args = decoratorNode.expression.arguments.map((arg: any) => {
        if (arg.type === 'Literal') {
          return arg.value;
        }
        return null; // Complex args not supported in this MVP
      });
    } else if (decoratorNode.expression.type === 'Identifier') {
      name = decoratorNode.expression.name;
    }

    return { name, arguments: args };
  }

  private extractParam(paramNode: any) {
    if (paramNode.type === 'TSParameterProperty') {
      return this.extractParam(paramNode.parameter);
    }

    if (paramNode.type === 'Identifier') {
      const name = paramNode.name;
      let type = 'any';

      if (paramNode.typeAnnotation && paramNode.typeAnnotation.typeAnnotation) {
        const typeNode = paramNode.typeAnnotation.typeAnnotation;
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

      return { name, type, decorators: [] };
    }
    return null;
  }
}
