export { resolveHttpNamesForDocuments, resolveHttpNamesForHosting } from './adapter-names';
export { buildDocsForHttpAdapters } from './docs';
export { createIndexHtml, indexResponse } from './index-html';
export { resolveDocFromPath } from './routing';
export { setupScalar } from './setup';
export { uiResponse } from './ui';
export { provideScalar } from './provide-scalar';
export { ScalarConfigurer } from './scalar-configurer';
export { ScalarConfigurerToken, ScalarSetupOptionsToken } from './tokens';

export type { AdapterCollectionLike, DocumentTargets, HttpTargets } from './types';
export type { Doc, ScalarSetupOptions } from './interfaces';
