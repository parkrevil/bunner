import * as ts from 'typescript';

export interface TypeMetadata {
  name: string;
  properties: {
    name: string;
    type: string;
    optional: boolean;
  }[];
}

export class TypeResolver {
  private program: ts.Program | undefined;
  private checker: ts.TypeChecker | undefined;

  constructor() {}

  init(fileNames: string[]) {
    this.program = ts.createProgram(fileNames, {});
    this.checker = this.program.getTypeChecker();
  }

  resolveDTO(fileName: string, className: string): TypeMetadata | null {
    if (!this.program || !this.checker) {
      throw new Error('TypeResolver not initialized. Call init() first.');
    }

    const sourceFile = this.program.getSourceFile(fileName);
    if (!sourceFile) {
      return null;
    }

    let result: TypeMetadata | null = null;

    ts.forEachChild(sourceFile, node => {
      if (ts.isClassDeclaration(node) && node.name?.text === className) {
        const symbol = this.checker!.getSymbolAtLocation(node.name);
        if (symbol) {
          const type = this.checker!.getDeclaredTypeOfSymbol(symbol);
          const properties = type.getApparentProperties();

          result = {
            name: className,
            properties: properties.map(prop => {
              const propDecl = prop.valueDeclaration;
              const propType = this.checker!.getTypeOfSymbolAtLocation(prop, propDecl!);
              return {
                name: prop.getName(),
                type: this.checker!.typeToString(propType),
                optional: (prop.flags & ts.SymbolFlags.Optional) !== 0,
              };
            }),
          };
        }
      }
    });

    return result;
  }
}
