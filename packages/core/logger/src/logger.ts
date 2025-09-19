import { toCString, resolveRustLibPath, LogLevel } from '@bunner/core';
import { dlopen } from 'bun:ffi';

import type { FfiSymbols } from './interfaces';

export class Logger {
  private static instance: Logger;
  private symbols: FfiSymbols;

  constructor() {
    try {
      const lib = dlopen(
        resolveRustLibPath('bunner_core_logger', import.meta.dir),
        {
          init: { args: [], returns: 'void' },
          log: { args: ['i32', 'cstring'], returns: 'void' },
        },
      );

      this.symbols = lib.symbols;
    } catch (e: any) {
      throw new Error(`Failed to initialize Logger: ${e.message}`);
    }
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new Logger();
    }

    return this.instance;
  }

  init() {
    this.symbols.init();
  }

  trace(message: string) {
    this.log(LogLevel.Trace, message);
  }

  debug(message: string) {
    this.log(LogLevel.Debug, message);
  }

  info(message: string) {
    this.log(LogLevel.Info, message);
  }

  warn(message: string) {
    this.log(LogLevel.Warn, message);
  }

  error(e: any) {
    if (typeof e === 'string') {
      this.log(LogLevel.Error, e);
      return;
    }

    // If an Error-like object is provided, serialize select fields.
    const payload = {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
      detail: e?.detail,
    };

    this.log(LogLevel.Error, payload);
  }

  private log(level: LogLevel, message: any) {
    this.symbols.log(level, toCString(message));
  }
}
