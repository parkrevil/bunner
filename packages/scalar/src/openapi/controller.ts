import type { ScalarInput, ScalarMetadataRegistry } from '../scalar/types';
import type { OpenApiDocument, OpenApiOperation } from './interfaces';

import { isRecord } from '../common';
import { addOperationMetadata, addOperationParameters, addOperationRequestBody, addOperationResponses } from './operation';
import { ensurePath, getControllerBasePath, getControllerTag, getHttpMethodDecorator, normalizeFullPath } from './utils';

export function processController(doc: OpenApiDocument, meta: ScalarInput, registry: ScalarMetadataRegistry): void {
  const basePath = getControllerBasePath(meta);
  const tag = getControllerTag(meta);
  const methodsValue = isRecord(meta) ? meta.methods : undefined;
  const methods = Array.isArray(methodsValue) ? methodsValue : [];

  for (const method of methods) {
    const httpMethodDec = getHttpMethodDecorator(method);

    if (!httpMethodDec) {
      continue;
    }

    const methodPathRaw = httpMethodDec.arguments?.[0];
    const methodPath = typeof methodPathRaw === 'string' && methodPathRaw.length > 0 ? methodPathRaw : '/';
    const httpMethod = String(httpMethodDec.name).toLowerCase();
    const fullPath = normalizeFullPath(basePath, methodPath);
    const pathItem = ensurePath(doc, fullPath);
    const classNameValue = isRecord(meta) ? meta.className : undefined;
    const className = typeof classNameValue === 'string' && classNameValue.length > 0 ? classNameValue : 'Controller';
    const methodNameValue = isRecord(method) ? method.name : undefined;
    const methodName = typeof methodNameValue === 'string' && methodNameValue.length > 0 ? methodNameValue : 'method';
    const operation: OpenApiOperation = {
      tags: [tag],
      operationId: `${className}_${methodName}`,
      parameters: [],
    };

    addOperationMetadata(operation, method);
    addOperationParameters(operation, method);
    addOperationRequestBody(operation, method, registry, doc);
    addOperationResponses(operation, method, registry, doc);

    pathItem[httpMethod] = operation;
  }
}
