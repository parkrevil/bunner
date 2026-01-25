import type { DecoratorMeta, OpenApiConfig, OpenApiDocument } from './openapi';
import type { ScalarMetadataRegistry } from './scalar/types';

import { isRecord } from './common';
import { createBaseDocument, getDecorator, processController } from './openapi';

export class OpenApiFactory {
  static create(registry: ScalarMetadataRegistry, config: OpenApiConfig): OpenApiDocument {
    const doc = createBaseDocument(config);

    for (const [, meta] of registry.entries()) {
      const decoratorsValue = isRecord(meta) ? meta.decorators : undefined;
      const decorators = Array.isArray(decoratorsValue) ? (decoratorsValue as DecoratorMeta[]) : undefined;
      const controller = getDecorator(decorators, ['Controller', 'RestController']);

      if (!controller) {
        continue;
      }

      processController(doc, meta, registry);
    }

    return doc;
  }
}
