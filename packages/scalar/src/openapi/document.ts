import type { OpenApiDocument } from './interfaces';

export function createBaseDocument(config: { title: string; version: string }): OpenApiDocument {
  return {
    openapi: '3.0.0',
    info: {
      title: config.title,
      version: config.version,
    },
    paths: {},
    components: {
      schemas: {},
    },
  };
}
