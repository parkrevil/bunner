import type { Color, LogArgument, LogLevel, LogMessage, LogMetadataRecord, LogMetadataValue } from './types';

export type { Color, LogArgument, LogLevel, LogMessage, LogMetadataRecord, LogMetadataValue } from './types';

export interface BaseLogMessage {
  level: LogLevel;
  msg: string;
  time: number;
  context?: string;
  reqId?: string;
  workerId?: number;
  err?: Error | Loggable;
}

export interface Loggable {
  toLog(): LogMetadataRecord;
}

export interface LogContextConstructor {
  name?: string;
}

export interface LogContextTarget {
  name?: string;
  constructor?: LogContextConstructor;
}

export interface LoggerPrettyOptions<T extends LogMetadataRecord = LogMetadataRecord> {
  colors?: Record<LogLevel, Color>;
  columns?: Array<keyof LogMessage<T>>;
}

export interface LoggerOptions<T extends LogMetadataRecord = LogMetadataRecord> {
  level?: LogLevel;

  format?: 'pretty' | 'json';
  prettyOptions?: LoggerPrettyOptions<T>;
}

export interface Transport {
  log<T>(message: LogMessage<T>): void;
}
