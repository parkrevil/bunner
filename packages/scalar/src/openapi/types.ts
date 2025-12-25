export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
}

export interface DecoratorMeta {
  name: string;
  arguments: unknown[];
}

export interface OpenApiOperation {
  parameters: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
