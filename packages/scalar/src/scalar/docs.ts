import { getRuntimeContext } from '@bunner/core';

import { isMap, isRecord } from '../common';
import { OpenApiFactory } from '../spec-factory';

import type { Doc } from './interfaces';

export function buildDocsForHttpAdapters(httpAdapterNames: string[], registry?: Map<any, any>): Doc[] {
  const registryValue = registry ?? getRuntimeContext().metadataRegistry;

  if (!registryValue) {
    throw new Error('Scalar: No Metadata Registry found. Ensure app.init() completes before Scalar binding.');
  }

  if (!isMap(registryValue)) {
    const found = isRecord(registryValue) ? 'object' : typeof registryValue;

    throw new Error(`Scalar: Invalid Metadata Registry. Expected Map, got: ${found}`);
  }

  const spec = OpenApiFactory.create(registryValue, {
    title: 'API Docs',
    version: '1.0.0',
  });

  return httpAdapterNames.map(name => ({
    docId: `openapi:http:${name}`,
    spec,
  }));
}
