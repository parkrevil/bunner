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

type NodeRecord = Record<string, unknown> & {
  readonly type: string;
};

export class AstTypeResolver {
  resolve(typeNode: unknown): TypeInfo {
    const node = this.asNode(typeNode);

    if (!node) {
      return { typeName: 'any' };
    }

    if (node.type === 'TSTypeReference') {
      const typeName = this.extractEntityName(node['typeName']);
      const typeArgs: string[] = [];
      const typeArguments = this.asNode(node['typeArguments']);
      const params = typeArguments ? this.getArray(typeArguments, 'params') : [];

      for (const param of params) {
        const resolved = this.resolve(param);

        typeArgs.push(resolved.typeName);
      }

      return { typeName, typeArgs: typeArgs.length > 0 ? typeArgs : undefined };
    }

    if (node.type === 'TSArrayType') {
      const elementType = this.resolve(node['elementType']);

      return {
        typeName: 'Array',
        typeArgs: [elementType.typeName],
        isArray: true,
        items: elementType,
      };
    }

    if (node.type === 'TSStringKeyword') {
      return { typeName: 'string' };
    }

    if (node.type === 'TSNumberKeyword') {
      return { typeName: 'number' };
    }

    if (node.type === 'TSBooleanKeyword') {
      return { typeName: 'boolean' };
    }

    if (node.type === 'TSVoidKeyword') {
      return { typeName: 'void' };
    }

    if (node.type === 'TSAnyKeyword') {
      return { typeName: 'any' };
    }

    if (node.type === 'TSLiteralType') {
      const literal = this.getRecord(node['literal']);
      const value = literal ? literal['value'] : undefined;

      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        return { typeName: 'any' };
      }

      return {
        typeName: typeof value,
        literals: [value],
      };
    }

    if (node.type === 'TSUnionType') {
      const typeNodes = this.getArray(node, 'types');
      const types = typeNodes.map(t => this.resolve(t));
      const allLiterals = types.length > 0 && types.every(t => t.literals && t.literals.length > 0);

      if (allLiterals) {
        return {
          typeName: types[0]!.typeName,
          isUnion: true,
          literals: types.flatMap((t: TypeInfo) => t.literals || []),
        };
      }

      const valid = types.find(t => t.typeName !== 'null' && t.typeName !== 'undefined' && t.typeName !== 'void');

      return {
        typeName: valid ? valid.typeName : 'any',
        isUnion: true,
        unionTypes: types,
      };
    }

    return { typeName: 'any' };
  }

  private extractEntityName(nodeValue: unknown): string {
    const node = this.asNode(nodeValue);

    if (!node) {
      return 'unknown';
    }

    if (node.type === 'Identifier') {
      return this.getString(node, 'name') || 'unknown';
    }

    if (node.type === 'TSQualifiedName') {
      const left = this.extractEntityName(node['left']);
      const rightNode = this.asNode(node['right']);
      const right = rightNode ? this.getString(rightNode, 'name') : null;

      if (!right) {
        return 'unknown';
      }

      return `${left}.${right}`;
    }

    return 'unknown';
  }

  private asNode(value: unknown): NodeRecord | null {
    const record = this.getRecord(value);

    if (!record) {
      return null;
    }

    const type = record.type;

    if (typeof type !== 'string') {
      return null;
    }

    return record as NodeRecord;
  }

  private getRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private getString(node: Record<string, unknown>, key: string): string | null {
    const value = node[key];

    if (typeof value !== 'string') {
      return null;
    }

    return value;
  }

  private getArray(node: Record<string, unknown>, key: string): unknown[] {
    const value = node[key];

    if (!Array.isArray(value)) {
      return [];
    }

    return value;
  }
}
