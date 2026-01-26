export { processController } from './controller';
export { createBaseDocument } from './document';
export { addOperationMetadata, addOperationParameters, addOperationRequestBody, addOperationResponses } from './operation';
export { getSchemaForType } from './schema';
export {
  ensurePath,
  extractDecorators,
  getControllerBasePath,
  getControllerTag,
  getDecorator,
  getHttpMethodDecorator,
  normalizeFullPath,
} from './utils';

export type {
  DecoratorMeta,
  OpenApiConfig,
  OpenApiDocument,
  OpenApiOperation,
  OpenApiPathItem,
  OpenApiRecord,
} from './interfaces';
