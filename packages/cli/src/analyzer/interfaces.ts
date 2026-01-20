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

export interface ImportEntry {
  source: string;
  resolvedSource: string;
  isRelative: boolean;
}

export interface AdapterEntryDecoratorsSpec {
  controller: string;
  handler: string[];
}

export interface AdapterRuntimeSpec {
  start: string;
  stop: string;
}

export interface PipelineSpec {
  middlewares: string[];
  guards: string[];
  pipes: string[];
  handler: string;
}

export interface AdapterStaticSpec {
  pipeline: PipelineSpec;
  middlewarePhaseOrder: string[];
  supportedMiddlewarePhases: Record<string, true>;
  entryDecorators: AdapterEntryDecoratorsSpec;
  runtime: AdapterRuntimeSpec;
}

export interface AdapterSpecExtraction {
  adapterId: string;
  staticSpec: AdapterStaticSpec;
}

export interface HandlerIndexEntry {
  id: string;
}

export interface AdapterSpecResolution {
  adapterStaticSpecs: Record<string, AdapterStaticSpec>;
  handlerIndex: HandlerIndexEntry[];
}
