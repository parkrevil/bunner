import type {
  LogArgument,
  LogContextTarget,
  LogLevel,
  LogMessage,
  LogMetadataRecord,
  LogMetadataValue,
  Loggable,
  LoggerOptions,
  Transport,
} from './interfaces';

import { RequestContext } from './async-storage';
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

  constructor(context?: string | LogContextTarget) {
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

  trace<T extends LogMetadataRecord = LogMetadataRecord>(msg: string, ...args: Array<T | LogArgument>) {
    this.log('trace', msg, ...args);
  }

  debug<T extends LogMetadataRecord = LogMetadataRecord>(msg: string, ...args: Array<T | LogArgument>) {
    this.log('debug', msg, ...args);
  }

  info<T extends LogMetadataRecord = LogMetadataRecord>(msg: string, ...args: Array<T | LogArgument>) {
    this.log('info', msg, ...args);
  }

  warn<T extends LogMetadataRecord = LogMetadataRecord>(msg: string, ...args: Array<T | LogArgument>) {
    this.log('warn', msg, ...args);
  }

  error<T extends LogMetadataRecord = LogMetadataRecord>(msg: string, ...args: Array<T | LogArgument>) {
    this.log('error', msg, ...args);
  }

  fatal<T extends LogMetadataRecord = LogMetadataRecord>(msg: string, ...args: Array<T | LogArgument>) {
    this.log('fatal', msg, ...args);
  }

  private log<T extends LogMetadataRecord = LogMetadataRecord>(
    level: LogLevel,
    msg: string,
    ...args: Array<T | LogArgument>
  ) {
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
    const configuredLevel = Logger.globalOptions.level ?? 'info';

    return levels.indexOf(level) >= levels.indexOf(configuredLevel);
  }

  private isLoggable(arg: LogMetadataValue): arg is Loggable {
    return Boolean(arg) && typeof arg === 'object' && typeof (arg as Loggable).toLog === 'function';
  }
}
