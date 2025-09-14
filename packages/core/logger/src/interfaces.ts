import type { LogLevel } from './enums';

export interface FfiSymbols {
  init: () => void;
  log: (level: LogLevel, message: Uint8Array) => void;
}
