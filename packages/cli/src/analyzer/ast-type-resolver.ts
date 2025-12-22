export interface TypeInfo {
  typeName: string;
  typeArgs?: string[];
  isUnion?: boolean;
  unionTypes?: TypeInfo[];
  isArray?: boolean;
  isEnum?: boolean;
  literals?: (string | number | boolean)[];
  items?: TypeInfo;
}

export class AstTypeResolver {
  resolve(typeNode: any): TypeInfo {
    if (!typeNode) {
      return { typeName: 'any' };
    }

    if (typeNode.type === 'TSTypeReference') {
      const typeName = this.extractEntityName(typeNode.typeName);
      const typeArgs: string[] = [];

      if (typeNode.typeArguments && typeNode.typeArguments.params) {
        typeNode.typeArguments.params.forEach((param: any) => {
          const resolved = this.resolve(param);

          typeArgs.push(resolved.typeName);
        });
      }

      return { typeName, typeArgs: typeArgs.length > 0 ? typeArgs : undefined };
    }

    if (typeNode.type === 'TSArrayType') {
      const elementType = this.resolve(typeNode.elementType);
      return {
        typeName: 'Array',
        typeArgs: [elementType.typeName],
        isArray: true,
        items: elementType,
      };
    }

    if (typeNode.type === 'TSStringKeyword') {
      return { typeName: 'string' };
    }
    if (typeNode.type === 'TSNumberKeyword') {
      return { typeName: 'number' };
    }
    if (typeNode.type === 'TSBooleanKeyword') {
      return { typeName: 'boolean' };
    }
    if (typeNode.type === 'TSVoidKeyword') {
      return { typeName: 'void' };
    }
    if (typeNode.type === 'TSAnyKeyword') {
      return { typeName: 'any' };
    }

    if (typeNode.type === 'TSLiteralType') {
      return {
        typeName: typeof typeNode.literal.value,
        literals: [typeNode.literal.value],
      };
    }

    if (typeNode.type === 'TSUnionType') {
      const types = (typeNode.types || []).map((t: any) => this.resolve(t));

      const allLiterals = types.every((t: TypeInfo) => t.literals && t.literals.length > 0);
      if (allLiterals) {
        return {
          typeName: types[0].typeName,
          isUnion: true,
          literals: types.flatMap((t: TypeInfo) => t.literals || []),
        };
      }

      const valid = types.find((t: TypeInfo) => t.typeName !== 'null' && t.typeName !== 'undefined' && t.typeName !== 'void');

      return {
        typeName: valid ? valid.typeName : 'any',
        isUnion: true,
        unionTypes: types,
      };
    }

    return { typeName: 'any' };
  }

  private extractEntityName(node: any): string {
    if (node.type === 'Identifier') {
      return node.name;
    }
    if (node.type === 'TSQualifiedName') {
      return `${this.extractEntityName(node.left)}.${node.right.name}`;
    }
    return 'unknown';
  }
}
