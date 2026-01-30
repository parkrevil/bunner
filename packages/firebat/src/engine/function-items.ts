import type { FunctionNodeAnalyzer, ParsedFile } from './types';

import { collectFunctionNodes } from './oxc-ast-utils';

const collectFunctionItems = <TItem>(
  files: ReadonlyArray<ParsedFile>,
  analyzeFunctionNode: FunctionNodeAnalyzer<TItem>,
): ReadonlyArray<TItem> => {
  const items: TItem[] = [];

  for (const file of files) {
    if (file.errors.length > 0) {
      continue;
    }

    const functions = collectFunctionNodes(file.program);

    for (const functionNode of functions) {
      const item = analyzeFunctionNode(functionNode, file.filePath, file.sourceText);

      if (item === null || item === undefined) {
        continue;
      }

      items.push(item);
    }
  }

  return items;
};

export { collectFunctionItems };
