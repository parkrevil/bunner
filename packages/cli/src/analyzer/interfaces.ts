export interface TypeMetadata {
  name: string;
  properties: {
    name: string;
    type: string;
    optional: boolean;
  }[];
}

export interface DecoratorMetadata {
  name: string;
  arguments: any[];
}

export interface ClassMetadata {
  className: string;
  heritage?: {
    clause: 'extends' | 'implements';
    typeName: string;
    typeArgs?: string[];
  };
  decorators: DecoratorMetadata[];
  constructorParams: {
    name: string;
    type: string;
    typeArgs?: string[];
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
    items?: any;
    isOptional?: boolean;
    isArray?: boolean;
    isEnum?: boolean;
    literals?: (string | number | boolean)[];
  }[];
  imports: Record<string, string>;
}
