export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type Color = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';

export interface BaseLogMessage {
  level: LogLevel;
  msg: string;
  time: number;
  context?: string;
  reqId?: string;
  workerId?: number;
  err?: Error | Loggable; 
}

export type LogMessage<T = Record<string, any>> = BaseLogMessage & T;

export interface Loggable {
  toLog(): Record<string, any>; 
}

export interface LoggerOptions<T = Record<string, any>> {

  level?: LogLevel;

  format?: 'pretty' | 'json';
  prettyOptions?: {
    colors?: Record<LogLevel, Color>;
    columns?: Array<keyof LogMessage<T>>; 
  };
}

export interface Transport {
  log<T>(message: LogMessage<T>): void;
}