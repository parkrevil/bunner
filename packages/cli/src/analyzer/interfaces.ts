/**
 * Serializable metadata about a type extracted by the CLI analyzer.
 */
export interface TypeMetadata {
  name: string;
  properties: {
    name: string;
    type: string;
    optional: boolean;
  }[];
}

export interface MiddlewareUsage {
  name: string;
  lifecycle?: string;
  index: number;
}

export interface ErrorFilterUsage {
  name: string;
  index: number;
}

export interface DecoratorMetadata {
  name: string;
  arguments: unknown[];
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
    type: unknown;
    typeArgs?: string[];
    decorators: DecoratorMetadata[];
  }[];
  methods: {
    name: string;
    decorators: DecoratorMetadata[];
    parameters: {
      name: string;
      type: unknown;
      typeArgs?: string[];
      decorators: DecoratorMetadata[];
      index: number;
    }[];
  }[];
  properties: {
    name: string;
    type: unknown;
    typeArgs?: string[];
    decorators: DecoratorMetadata[];
    items?: unknown;
    isOptional?: boolean;
    isArray?: boolean;
    isEnum?: boolean;
    literals?: (string | number | boolean)[];
  }[];
  imports: Record<string, string>;
  middlewares?: MiddlewareUsage[];
  errorFilters?: ErrorFilterUsage[];
}
