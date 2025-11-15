import { LogLevel } from '@bunner/core';

export class Logger {
  private static instance: Logger;

  static getInstance() {
    if (!this.instance) {
      this.instance = new Logger();
    }

    return this.instance;
  }

  init() {}

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

  private log(_level: LogLevel, _message: any) {}
}
