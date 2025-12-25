import type { DocumentTargets, HttpTargets } from './types';

export interface ScalarSetupOptions {
  documentTargets: DocumentTargets;
  httpTargets: HttpTargets;
}

export interface Doc {
  docId: string;
  spec: unknown;
}

export interface InternalRouter {
  get: (path: string, handler: (req: unknown) => Response) => void;
}
