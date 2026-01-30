import { BunnerSymbol, type ModuleMarker } from '@bunner/common';
import type { DefineModuleOptions } from './interfaces';

export function defineModule(_options?: DefineModuleOptions): ModuleMarker {
  return Symbol(BunnerSymbol.Module);
}
