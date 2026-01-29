import type { ParsedFile } from '../../engine/types';
import type { DuplicateGroup } from '../../types';

import { detectDuplicatesOxc } from '../../engine/duplicate-detector-oxc';

export const detectDuplicates = (files: ParsedFile[], minTokens: number): DuplicateGroup[] =>
  detectDuplicatesOxc(files, minTokens);
