import type { Node } from 'oxc-parser';

import type { SourceSpan } from '../types';

import { getLineColumn } from './source-position';

const getFunctionSpan = (functionNode: Node, sourceText: string): SourceSpan => {
  return {
    start: getLineColumn(sourceText, functionNode.start),
    end: getLineColumn(sourceText, functionNode.end),
  };
};

export { getFunctionSpan };
