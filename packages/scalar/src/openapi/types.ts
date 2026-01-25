import type { ScalarInput, ScalarList, ScalarNode, ScalarObjectList, ScalarShallowRecord, ScalarValue } from '../scalar/types';

export interface OpenApiInfo {
  title: string;
  version: string;
}

export interface OpenApiConfig {
  title: string;
  version: string;
}

export interface OpenApiComponents {
  schemas: Record<string, OpenApiSchema>;
}

export interface OpenApiParameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: OpenApiSchema;
}

export interface OpenApiOperation {
  parameters: OpenApiParameter[];
  summary?: string;
  description?: string;
  requestBody?: OpenApiRecord;
  responses?: OpenApiRecord;
  tags?: string[];
  operationId?: string;
  [key: string]: ScalarValue | ScalarList | OpenApiRecord | OpenApiParameter[] | undefined;
}

export interface OpenApiPathItem {
  [method: string]: OpenApiOperation;
}

export interface OpenApiDocument {
  openapi: string;
  info: OpenApiInfo;
  paths: Record<string, OpenApiPathItem>;
  components: OpenApiComponents;
}

export interface OpenApiRecord {
  [key: string]: ScalarValue | ScalarList | ScalarObjectList | ScalarShallowRecord | OpenApiRecord;
}

export type OpenApiValue = ScalarValue | ScalarList | ScalarObjectList | ScalarShallowRecord | OpenApiRecord;

export type OpenApiSchema = OpenApiRecord;

export interface DecoratorMeta {
  name: string;
  arguments: ScalarNode[];
}

export interface PropertyItemMeta {
  typeName?: ScalarInput;
}

export interface PropertyMeta {
  name?: string;
  type?: ScalarInput;
  isArray?: boolean;
  isClass?: boolean;
  items?: PropertyItemMeta;
  decorators?: DecoratorMeta[];
}

export interface ParameterMeta {
  name?: string;
  type?: ScalarInput;
  decorators?: DecoratorMeta[];
}

export interface MethodMeta {
  name?: string;
  decorators?: DecoratorMeta[];
  parameters?: ParameterMeta[];
}

export interface ClassMeta {
  className?: string;
  decorators?: DecoratorMeta[];
  methods?: MethodMeta[];
  properties?: PropertyMeta[];
}
