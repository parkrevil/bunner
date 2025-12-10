import type { NormalizedPathSegments } from '../types';

import { ProcessorContext } from './context';
import type { ProcessorConfig, PipelineStep } from './context';
import { toLowerCase } from './steps/case-sensitivity';
import { resolveDotSegments } from './steps/dot-segments';
import { removeLeadingSlash } from './steps/remove-leading-slash';
import { collapseSlashes, handleTrailingSlashOptions } from './steps/slashes';
import { splitPath } from './steps/split';
import { stripQuery } from './steps/strip-query';
import { validateSegments } from './steps/validation';

/**
 * Normalizes and validates URL paths using a configurable pipeline of steps.
 * Designed to separate concerns (splitting, decoding, validation) into distinct operations.
 */
export class Processor {
  private readonly config: ProcessorConfig;
  private readonly pipeline: PipelineStep[];

  constructor(config: ProcessorConfig) {
    this.config = config;
    this.pipeline = [];

    // --- Pipeline Construction ---

    // 1. Pre-processing
    this.pipeline.push(stripQuery);
    this.pipeline.push(removeLeadingSlash);

    // 2. Segmentation
    this.pipeline.push(splitPath);

    // 3. Post-processing
    if (config.blockTraversal) {
      this.pipeline.push(resolveDotSegments);
    }

    if (config.collapseSlashes) {
      this.pipeline.push(collapseSlashes);
    } else if (config.ignoreTrailingSlash) {
      this.pipeline.push(handleTrailingSlashOptions);
    }

    if (config.caseSensitive === false) {
      this.pipeline.push(toLowerCase);
    }

    // 4. Validation
    this.pipeline.push(validateSegments);
  }

  /**
   * Process a raw path string into normalized segments.
   * @param path The raw URL path.
   * @param stripQueryParam If true, processes the path to remove query strings (default behavior).
   */
  normalize(path: string, stripQueryParam = true): NormalizedPathSegments {
    const ctx = new ProcessorContext(path, this.config);

    // Pipeline Execution
    // Note: The 'stripQuery' step is currently the first step (index 0).
    // If stripQueryParam is false, we skip it.
    const startStepIndex = stripQueryParam ? 0 : 1;

    for (let i = startStepIndex; i < this.pipeline.length; i++) {
      this.pipeline[i]!(ctx);
    }

    return {
      normalized: '/' + ctx.segments.join('/'),
      segments: ctx.segments,
      segmentDecodeHints: ctx.segmentDecodeHints,
      suffixPlan: undefined,
    };
  }
}
