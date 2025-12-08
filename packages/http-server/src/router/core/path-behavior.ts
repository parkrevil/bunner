import type { PathNormalizer, PathNormalizerConfig } from '../utils/path-utils';

import { PathNormalizerFactory } from './path-normalizer-factory';
import type { NormalizedRouterOptions } from './router-options';

export interface PathBehaviorProfile {
  normalizePath: PathNormalizer;
  literalNormalizer?: PathNormalizer;
  requiresNormalization: boolean;
  needsCaseNormalization: boolean;
  needsTrailingNormalization: boolean;
  collapseSlashesEnabled: boolean;
  blockTraversalEnabled: boolean;
  caseSensitive: boolean;
  ignoreTrailingSlash: boolean;
}

export function createPathBehavior(options: NormalizedRouterOptions): PathBehaviorProfile {
  const config: PathNormalizerConfig = {
    ignoreTrailingSlash: options.ignoreTrailingSlash,
    collapseSlashes: options.collapseSlashes,
    blockTraversal: options.blockTraversal,
    caseSensitive: options.caseSensitive,
    failFastOnBadEncoding: options.failFastOnBadEncoding,
    maxSegmentLength: options.maxSegmentLength,
  };
  const normalizePath = PathNormalizerFactory.create(config);
  const requiresNormalization = options.collapseSlashes || options.blockTraversal;
  const needsCaseNormalization = !options.caseSensitive;
  const needsTrailingNormalization = options.ignoreTrailingSlash;

  let literalNormalizer: PathNormalizer | undefined;
  if (requiresNormalization) {
    const literalConfig: PathNormalizerConfig = {
      ignoreTrailingSlash: options.ignoreTrailingSlash,
      collapseSlashes: options.collapseSlashes,
      blockTraversal: options.blockTraversal,
      caseSensitive: true,
      failFastOnBadEncoding: options.failFastOnBadEncoding,
      maxSegmentLength: options.maxSegmentLength,
    };
    literalNormalizer = PathNormalizerFactory.create(literalConfig);
  }

  return {
    normalizePath,
    literalNormalizer,
    requiresNormalization,
    needsCaseNormalization,
    needsTrailingNormalization,
    collapseSlashesEnabled: options.collapseSlashes,
    blockTraversalEnabled: options.blockTraversal,
    caseSensitive: options.caseSensitive,
    ignoreTrailingSlash: options.ignoreTrailingSlash,
  };
}
