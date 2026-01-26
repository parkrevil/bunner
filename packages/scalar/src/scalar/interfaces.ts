import type { BunnerRecord } from '@bunner/common';

import type { OpenApiDocument } from '../openapi';

import type { DocumentTarget, DocumentTargets, HttpTargets, ScalarMetadataRegistry } from './types';

export interface ScalarSetupOptions extends BunnerRecord {
  documentTargets: DocumentTargets;
  httpTargets: HttpTargets;
}

export interface Doc {
  docId: string;
  spec: OpenApiDocument;
}

export interface ResolvedDocPath {
  docId: string;
  isJson: boolean;
}

export interface ScalarRequest {
  path?: string;
}

export type InternalRouteHandler = (req: ScalarRequest) => Response;

export interface InternalRouter {
  get: (path: string, handler: InternalRouteHandler) => void;
}

export interface ScalarOptionsWithRegistry {
  metadataRegistry?: ScalarMetadataRegistry;
}

export interface ScalarSetupOptionsInput extends ScalarOptionsWithRegistry {
  documentTargets?: string | DocumentTarget[];
  httpTargets?: string | string[] | undefined;
}
