import type { OpenApiConfig, OpenApiDocument } from './openapi';
import type { ScalarMetadataRegistry } from './scalar/types';

import { createBaseDocument, extractDecorators, getDecorator, processController } from './openapi';

export class OpenApiFactory {
  static create(registry: ScalarMetadataRegistry, config: OpenApiConfig): OpenApiDocument {
    const doc = createBaseDocument(config);

    for (const [, meta] of registry.entries()) {
      const decorators = extractDecorators(meta);
      const controller = getDecorator(decorators, ['Controller', 'RestController']);

      if (!controller) {
        continue;
      }

      processController(doc, meta, registry);
    }

    return doc;
  }
}
