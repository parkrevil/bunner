import type { ParsedFile } from '../../engine/types';
import type { DuplicateGroup } from '../../types';

import { detectDuplicatesOxc } from '../../engine/duplicate-detector-oxc';

export const detectDuplicates = (files: ParsedFile[], minSize: number): DuplicateGroup[] => {
  if (files.length === 0) {
    return [];
  }

  return detectDuplicatesOxc(files, minSize);
};
