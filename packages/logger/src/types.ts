import type { BaseLogMessage, Loggable } from './interfaces';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type Color = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';

export type LogMetadataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Error
  | Loggable
  | LogMetadataRecord
  | ReadonlyArray<LogMetadataValue>;

export type LogMetadataRecord = Record<string, LogMetadataValue>;

export type LogMessage<T extends LogMetadataRecord = LogMetadataRecord> = BaseLogMessage & T;

export type LogArgument = LogMetadataRecord | Error | Loggable;
