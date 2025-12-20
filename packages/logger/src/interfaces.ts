export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type Color = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';

// Base fields always present
export interface BaseLogMessage {
  level: LogLevel;
  msg: string;
  time: number;
  context?: string;
  reqId?: string;
  workerId?: number;
  err?: Error | Loggable; // Standard error field
}

// User-defined fields merged at root level
export type LogMessage<T = Record<string, any>> = BaseLogMessage & T;

export interface Loggable {
  toLog(): Record<string, any>; // Custom serialization hook
}

export interface LoggerOptions<T = Record<string, any>> {
  /**
   * Minimum log level to print.
   * @default 'info'
   */
  level?: LogLevel;
  /**
   * Log format.
   * @default 'auto' (pretty in dev, json in prod)
   */
  format?: 'pretty' | 'json';
  prettyOptions?: {
    colors?: Record<LogLevel, Color>;
    columns?: Array<keyof LogMessage<T>>; // Strict typing for all columns
  };
}

export interface Transport {
  log<T>(message: LogMessage<T>): void;
}
