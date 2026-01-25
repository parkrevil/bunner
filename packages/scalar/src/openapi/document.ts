import type { OpenApiDocument } from './interfaces';
import type { OpenApiConfig } from './types';

export function createBaseDocument(config: OpenApiConfig): OpenApiDocument {
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
