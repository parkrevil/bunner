import type { DocumentTargets, HttpTargets, ScalarMetadataRegistry, ScalarRecord } from './types';

export interface ScalarSetupOptions {
  documentTargets: DocumentTargets;
  httpTargets: HttpTargets;
}

export interface Doc {
  docId: string;
  spec: ScalarRecord;
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
