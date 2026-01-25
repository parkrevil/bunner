import type { ParsedFile } from './engine/oxc-wrapper';
import type { ResourceWasteFinding } from './types';

import { detectResourceWasteOxc } from './engine/resource-waste-detector-oxc';

export const detectResourceWaste = (files: ParsedFile[]): ResourceWasteFinding[] => detectResourceWasteOxc(files);
