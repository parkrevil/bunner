import { isRecord } from './common';
import { createBaseDocument, getDecorator, processController } from './openapi';
import type { DecoratorMeta, OpenApiDocument } from './openapi';

export class OpenApiFactory {
  static create(registry: Map<unknown, unknown>, config: { title: string; version: string }): OpenApiDocument {
    const doc = createBaseDocument(config);

    for (const [, meta] of registry.entries()) {
      const decoratorsValue = isRecord(meta) ? meta['decorators'] : undefined;
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
