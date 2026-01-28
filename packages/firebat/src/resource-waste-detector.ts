import type { ParsedFile } from './engine/types';
import type { ResourceWasteFinding } from './types';

import { detectResourceWasteOxc } from './engine/resource-waste-detector-oxc';

export const detectResourceWaste = (files: ParsedFile[]): ResourceWasteFinding[] => detectResourceWasteOxc(files);
