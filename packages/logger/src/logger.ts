import { RequestContext } from './async-storage';
import type { LoggerOptions, LogLevel, LogMessage, Transport, Loggable } from './interfaces';
import { ConsoleTransport } from './transports/console';

declare global {
  var WORKER_ID: number | undefined;
}

export class Logger {
  private static globalOptions: LoggerOptions = {
    level: 'info',
    format: process.env.NODE_ENV === 'production' ? 'json' : undefined,
  };
  private static transport: Transport = new ConsoleTransport(Logger.globalOptions);

  private readonly context?: string;

  constructor(context?: string | Function | object) {
    if (typeof context === 'function') {
      this.context = context.name;
    } else if (typeof context === 'object' && context !== null) {
      this.context = context.constructor.name;
    } else if (typeof context === 'string') {
      this.context = context;
    }
  }

  static configure(options: LoggerOptions) {
    this.globalOptions = { ...this.globalOptions, ...options };
    this.transport = new ConsoleTransport(this.globalOptions);
  }

  /* -------------------------------------------------------------------------- */
  /*                               Logging Methods                              */
  /* -------------------------------------------------------------------------- */

  trace<T = Record<string, any>>(msg: string, ...args: (T | Error | Loggable)[]) {
    this.log('trace', msg, ...args);
  }

  debug<T = Record<string, any>>(msg: string, ...args: (T | Error | Loggable)[]) {
    this.log('debug', msg, ...args);
  }

  info<T = Record<string, any>>(msg: string, ...args: (T | Error | Loggable)[]) {
    this.log('info', msg, ...args);
  }

  warn<T = Record<string, any>>(msg: string, ...args: (T | Error | Loggable)[]) {
    this.log('warn', msg, ...args);
  }

  error<T = Record<string, any>>(msg: string, ...args: (T | Error | Loggable)[]) {
    this.log('error', msg, ...args);
  }

  fatal<T = Record<string, any>>(msg: string, ...args: (T | Error | Loggable)[]) {
    this.log('fatal', msg, ...args);
  }

  /* -------------------------------------------------------------------------- */
  /*                               Internal Logic                               */
  /* -------------------------------------------------------------------------- */

  private log<T = Record<string, any>>(level: LogLevel, msg: string, ...args: (T | Error | Loggable)[]) {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const logMessage: LogMessage<T> = {
      level,
      msg,
      time: Date.now(),
      context: this.context,
      reqId: RequestContext.getRequestId(),
      workerId: globalThis.WORKER_ID,
    } as LogMessage<T>;

    for (const arg of args) {
      if (arg instanceof Error) {
        logMessage.err = arg;
      } else if (this.isLoggable(arg)) {
        Object.assign(logMessage, arg.toLog());
      } else if (typeof arg === 'object' && arg !== null) {
        Object.assign(logMessage, arg);
      }
    }

    Logger.transport.log(logMessage);
  }

  private isLevelEnabled(level: LogLevel): boolean {
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const configuredLevel = Logger.globalOptions.level || 'info';
    return levels.indexOf(level) >= levels.indexOf(configuredLevel);
  }

  private isLoggable(arg: any): arg is Loggable {
    return arg && typeof arg === 'object' && typeof arg.toLog === 'function';
  }
}
