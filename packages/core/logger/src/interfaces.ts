import type { LogLevel } from './types';

export interface FfiSymbols {
  init_logger: () => void;
  log_message: (level: LogLevel, message: Uint8Array) => void;
}
