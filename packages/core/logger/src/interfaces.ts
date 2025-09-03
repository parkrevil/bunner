import type { LogLevel } from './types';

export interface FfiSymbols {
  init: () => void;
  log: (level: LogLevel, message: Uint8Array) => void;
}
