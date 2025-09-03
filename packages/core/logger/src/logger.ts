import { encodeCString, resolveRustLibPath } from '@bunner/core';
import { dlopen } from 'bun:ffi';

import { LogType } from './constants';
import type { FfiSymbols } from './interfaces';
import type { LogLevel } from './types';

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
    this.log(LogType.trace, message);
  }

  debug(message: string) {
    this.log(LogType.debug, message);
  }

  info(message: string) {
    this.log(LogType.info, message);
  }

  warn(message: string) {
    this.log(LogType.warn, message);
  }

  error(message: string) {
    this.log(LogType.error, message);
  }

  private log(level: LogLevel, message: string) {
    this.symbols.log(level, encodeCString(message));
  }
}
