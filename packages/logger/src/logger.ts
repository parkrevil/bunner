import type { LogArgument, LogContextTarget, LogLevel, LogMessage, LogMetadataValue, Loggable, LoggerOptions, Transport } from './interfaces';

import { RequestContext } from './async-storage';
import { ConsoleTransport } from './transports/console';

declare global {
  var WORKER_ID: number | undefined;
}

export class Logger {
  private static globalOptions: LoggerOptions = {
    level: 'info',
    ...(Bun.env.NODE_ENV === 'production' ? { format: 'json' } : {}),
  };
  private static transport: Transport = new ConsoleTransport(Logger.globalOptions);

  private readonly context?: string;

  constructor(context?: string | LogContextTarget) {
    if (typeof context === 'function') {
      this.context = context.name;
    } else if (typeof context === 'object' && context !== null) {
      const constructorName = context.constructor?.name;

      if (typeof constructorName === 'string' && constructorName.length > 0) {
        this.context = constructorName;
      }
    } else if (typeof context === 'string') {
      this.context = context;
    }
  }

  static configure(options: LoggerOptions) {
    this.globalOptions = { ...this.globalOptions, ...options };
    this.transport = new ConsoleTransport(this.globalOptions);
  }

  trace(msg: string, ...args: ReadonlyArray<LogArgument>) {
    this.log('trace', msg, ...args);
  }

  debug(msg: string, ...args: ReadonlyArray<LogArgument>) {
    this.log('debug', msg, ...args);
  }

  info(msg: string, ...args: ReadonlyArray<LogArgument>) {
    this.log('info', msg, ...args);
  }

  warn(msg: string, ...args: ReadonlyArray<LogArgument>) {
    this.log('warn', msg, ...args);
  }

  error(msg: string, ...args: ReadonlyArray<LogArgument>) {
    this.log('error', msg, ...args);
  }

  fatal(msg: string, ...args: ReadonlyArray<LogArgument>) {
    this.log('fatal', msg, ...args);
  }

  private log(level: LogLevel, msg: string, ...args: ReadonlyArray<LogArgument>) {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const logMessage: LogMessage = {
      level,
      msg,
      time: Date.now(),
    };

    if (this.context !== undefined) {
      logMessage.context = this.context;
    }

    const reqId = RequestContext.getRequestId();

    if (reqId !== undefined) {
      logMessage.reqId = reqId;
    }

    const workerId = globalThis.WORKER_ID;

    if (workerId !== undefined) {
      logMessage.workerId = workerId;
    }

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
    const configuredLevel = Logger.globalOptions.level ?? 'info';

    return levels.indexOf(level) >= levels.indexOf(configuredLevel);
  }

  private isLoggable(arg: LogMetadataValue): arg is Loggable {
    return typeof arg === 'object' && arg !== null && 'toLog' in arg && typeof arg.toLog === 'function';
  }
}
