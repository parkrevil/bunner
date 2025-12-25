import { hasFunctionProperty, isObjectLike, isRecord } from '../common';

import { resolveHttpNamesForDocuments, resolveHttpNamesForHosting } from './adapter-names';
import { buildDocsForHttpAdapters } from './docs';
import { indexResponse } from './index-html';
import type { Doc, InternalRouter, ScalarSetupOptions } from './interfaces';
import { resolveDocFromPath } from './routing';
import type { AdapterCollectionLike } from './types';
import { uiResponse } from './ui';

const BUNNER_HTTP_INTERNAL = Symbol.for('bunner:http:internal');
const boundAdapters = new WeakSet<object>();

function jsonResponse(doc: Doc): Response {
  return new Response(JSON.stringify(doc.spec), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function registerInternalRoutes(internal: InternalRouter, docs: Doc[], docsById: Map<string, Doc>): void {
  internal.get('/api-docs', () => {
    if (docs.length === 1) {
      const onlyDoc = docs[0];

      if (onlyDoc) {
        return uiResponse(onlyDoc);
      }
    }

    return indexResponse(docs);
  });
  internal.get('/api-docs/*', (req: unknown) => {
    const reqPath = isRecord(req) ? req['path'] : undefined;
    const path = typeof reqPath === 'string' ? reqPath : '';
    const resolved = resolveDocFromPath(path);

    if (!resolved) {
      return new Response('Not Found', { status: 404 });
    }

    const doc = docsById.get(resolved.docId);

    if (!doc) {
      return new Response('Not Found', { status: 404 });
    }

    return resolved.isJson ? jsonResponse(doc) : uiResponse(doc);
  });
}

export function setupScalar(adapters: AdapterCollectionLike, options: ScalarSetupOptions): void {
  if (!options || !('documentTargets' in options) || !('httpTargets' in options)) {
    throw new Error('Scalar.setup: options { documentTargets, httpTargets } is required.');
  }

  if (options.documentTargets !== 'all' && !Array.isArray(options.documentTargets)) {
    throw new Error('Scalar.setup: documentTargets must be "all" or an array of targets.');
  }

  if (options.httpTargets !== 'all' && !Array.isArray(options.httpTargets)) {
    throw new Error('Scalar.setup: httpTargets must be "all" or an array of names.');
  }

  if (options.httpTargets === undefined || options.httpTargets === null) {
    throw new Error('Scalar: httpTargets must be specified.');
  }

  const httpDocNames = resolveHttpNamesForDocuments(adapters, options.documentTargets);
  const docs = buildDocsForHttpAdapters(httpDocNames);
  const docsById = new Map(docs.map(d => [d.docId, d] as const));
  const httpHostNames = resolveHttpNamesForHosting(adapters, options.httpTargets);

  if (httpHostNames.length === 0) {
    throw new Error('Scalar: no HTTP adapter selected/found. Install/add @bunner/http-adapter and register an http adapter.');
  }

  const adaptersRecord = adapters as unknown as Record<string, unknown>;
  const httpGroup = adaptersRecord['http'];

  if (!hasFunctionProperty(httpGroup, 'get')) {
    throw new Error('Scalar: selected http adapter group does not support lookup (missing .get).');
  }

  for (const name of httpHostNames) {
    const adapter = httpGroup.get(name);

    if (!adapter) {
      throw new Error(`Scalar: selected http target not found: ${name}`);
    }

    if (!isObjectLike(adapter)) {
      throw new Error(`Scalar: selected http adapter is not an object: ${name}`);
    }

    if (boundAdapters.has(adapter)) {
      continue;
    }

    const adapterRecord = adapter as unknown as Record<PropertyKey, unknown>;
    const internalValue = adapterRecord[BUNNER_HTTP_INTERNAL];

    if (!internalValue || !hasFunctionProperty(internalValue, 'get')) {
      throw new Error('Scalar: selected http adapter does not support internal route binding (upgrade http-adapter).');
    }

    registerInternalRoutes(internalValue as unknown as InternalRouter, docs, docsById);
    boundAdapters.add(adapter);
  }
}
