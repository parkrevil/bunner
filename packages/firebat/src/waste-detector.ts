import type { ParsedFile } from './engine/types';
import type { WasteFinding } from './types';

import { detectWasteOxc } from './engine/waste-detector-oxc';

export const detectWaste = (files: ParsedFile[]): WasteFinding[] => detectWasteOxc(files);