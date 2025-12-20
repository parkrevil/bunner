export interface TypeInfo {
  typeName: string;
  typeArgs?: string[];
  isUnion?: boolean;
  unionTypes?: TypeInfo[];
  isArray?: boolean;
  isEnum?: boolean;
  literals?: (string | number | boolean)[];
  items?: TypeInfo; // For Array Element Type
}

export class TypeResolver {
  /**
   * AST의 TypeAnnotation 노드를 분석하여 TypeInfo를 반환합니다.
   * 복잡한 제네릭(Promise<User>)이나 배열(User[]) 등을 재귀적으로 분석합니다.
   */
  resolve(typeNode: any): TypeInfo {
    if (!typeNode) {
      return { typeName: 'any' };
    }

    // 1. TSTypeReference (e.g., Promise<User>, MyClass)
    if (typeNode.type === 'TSTypeReference') {
      const typeName = this.extractEntityName(typeNode.typeName);
      const typeArgs: string[] = [];

      if (typeNode.typeArguments && typeNode.typeArguments.params) {
        typeNode.typeArguments.params.forEach((param: any) => {
          const resolved = this.resolve(param);
          // 단순화를 위해 제네릭 인자의 루트 타입 이름만 가져옴 (나중에 더 깊게 가능)
          // e.g. Promise<User> -> ['User']
          // e.g. Promise<User[]> -> ['Array'] (User[]는 Array로 보니까)
          // 개선: User[]는 typeName이 Array, typeArgs가 ['User']임.
          // 여기서 우리는 문자열 표현이 필요할 때 typeName을 쓰고, 내부 구조가 필요할 때 typeArgs를 씀.

          if (resolved.isArray) {
            // 배열인 경우 'User[]' 같은 문자열로 만들거나 'Array'로 풀지 결정
            // NestJS 메타데이터 호환성을 위해 보통 단순 이름이 필요함.
            // 하지만 우리는 더 정교해야 함.
            // 일단 resolved.typeName을 넣음.
          }
          typeArgs.push(resolved.typeName);
        });
      }

      return { typeName, typeArgs: typeArgs.length > 0 ? typeArgs : undefined };
    }

    // 2. TSArrayType (e.g., User[])
    if (typeNode.type === 'TSArrayType') {
      const elementType = this.resolve(typeNode.elementType);
      return {
        typeName: 'Array',
        typeArgs: [elementType.typeName],
        isArray: true,
        items: elementType,
      };
    }

    // 3. Primitives
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

    // 4. Literal Types (e.g. 'admin', 123)
    if (typeNode.type === 'TSLiteralType') {
      return {
        typeName: typeof typeNode.literal.value,
        literals: [typeNode.literal.value],
      };
    }

    // 5. TSUnionType (e.g., 'admin' | 'user', User | null)
    if (typeNode.type === 'TSUnionType') {
      const types = (typeNode.types || []).map((t: any) => this.resolve(t));

      // Check for String/Number Literal Union
      const allLiterals = types.every((t: TypeInfo) => t.literals && t.literals.length > 0);
      if (allLiterals) {
        return {
          typeName: types[0].typeName, // 'string' or 'number'
          isUnion: true,
          literals: types.flatMap((t: TypeInfo) => t.literals || []),
        };
      }

      // Standard Union (Pick first valid non-null)
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
