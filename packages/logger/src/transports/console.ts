import type {
  Color,
  LogMessage,
  LogLevel,
  LogMetadataRecord,
  LogMetadataValue,
  Loggable,
  LoggerOptions,
  Transport,
} from '../interfaces';

const DEFAULT_COLORS: Record<LogLevel, Color> = {
  trace: 'gray',
  debug: 'blue',
  info: 'green',
  warn: 'yellow',
  error: 'red',
  fatal: 'magenta',
};
const RESET = '\x1b[0m';
const COLORS: Record<Color, string> = {
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

export class ConsoleTransport implements Transport {
  constructor(private options: LoggerOptions = {}) {}

  log<T>(message: LogMessage<T>): void {
    const format = this.options.format ?? (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');

    if (format === 'json') {
      this.logJson(message);
    } else {
      this.logPretty(message);
    }
  }

  private logJson<T>(message: LogMessage<T>): void {
    const replacer = (_key: string, value: LogMetadataValue) => {
      if (value instanceof Error) {
        const { name, message, stack, ...rest } = value;

        return {
          name,
          message,
          stack,
          ...rest,
        };
      }

      if (this.isLoggable(value)) {
        return value.toLog();
      }

      return value;
    };

    const str = JSON.stringify(message, replacer);

    process.stdout.write(str + '\n');
  }

  private logPretty<T>(message: LogMessage<T>): void {
    const { level, time, msg, context, reqId, workerId, err, ...rest } = message;
    const date = new Date(time);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    const timeColored = `${COLORS.gray}${timeStr}${RESET}`;
    const color = this.options.prettyOptions?.colors?.[level] ?? DEFAULT_COLORS[level];
    const levelCode = COLORS[color] || COLORS.white;
    const levelStr = `${levelCode}${level.toUpperCase().padEnd(5)}${RESET}`;
    let metaStr = '';

    if (workerId !== undefined) {
      metaStr += `[W:${workerId}] `;
    }

    if (reqId) {
      metaStr += `[${reqId}] `;
    }

    if (context) {
      metaStr += `[${COLORS.cyan}${context}${RESET}] `;
    }

    const msgStr = `${levelCode}${msg}${RESET}`;
    const line = `${timeColored} ${levelStr} ${metaStr}${msgStr}`;

    if (level === 'error' || level === 'fatal') {
      console.error(line);
    } else {
      console.log(line);
    }

    if (err) {
      console.error(err);
    }

    if (Object.keys(rest).length > 0) {
      const processedRest: LogMetadataRecord = {};

      for (const [key, val] of Object.entries(rest as LogMetadataRecord)) {
        if (this.isLoggable(val)) {
          processedRest[key] = val.toLog();
        } else {
          processedRest[key] = val;
        }
      }

      console.log(Bun.inspect(processedRest, { colors: true, depth: 2 }));
    }
  }

  private isLoggable(value: LogMetadataValue): value is Loggable {
    return Boolean(value) && typeof value === 'object' && typeof (value as Loggable).toLog === 'function';
  }
}
