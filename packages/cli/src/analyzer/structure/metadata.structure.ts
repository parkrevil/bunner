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
    typeArgs?: string[]; // Generic Arguments e.g. ['User'] for Promise<User>
    decorators: DecoratorMetadata[];
  }[];
  methods: {
    name: string;
    decorators: DecoratorMetadata[];
    parameters: {
      name: string;
      type: string;
      typeArgs?: string[];
      decorators: DecoratorMetadata[];
      index: number;
    }[];
  }[];
  properties: {
    name: string;
    type: string;
    typeArgs?: string[];
    decorators: DecoratorMetadata[];
  }[];
  imports: Record<string, string>; // Identifier -> Source Path
}
