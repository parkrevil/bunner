import type { Transport, LogMessage, LogLevel, Color, LoggerOptions } from '../interfaces';

const DEFAULT_COLORS: Record<LogLevel, Color> = {
  trace: 'gray',
  debug: 'blue',
  info: 'green',
  warn: 'yellow',
  error: 'red',
  fatal: 'magenta',
};

// ANSI Color Codes
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
    const format = this.options.format || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');

    if (format === 'json') {
      this.logJson(message);
    } else {
      this.logPretty(message);
    }
  }

  private logJson<T>(message: LogMessage<T>): void {
    const replacer = (_key: string, value: any) => {
      if (value instanceof Error) {
        const { name, message, stack, ...rest } = value;
        return {
          name,
          message,
          stack,
          ...rest,
        };
      }
      if (value && typeof value === 'object' && 'toLog' in value && typeof value.toLog === 'function') {
        return value.toLog();
      }
      return value;
    };

    const str = JSON.stringify(message, replacer);
    process.stdout.write(str + '\n');
  }

  private logPretty<T>(message: LogMessage<T>): void {
    const { level, time, msg, context, reqId, workerId, err, ...rest } = message;

    // 1. Time
    const date = new Date(time);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    const timeColored = `${COLORS.gray}${timeStr}${RESET}`;

    // 2. Level
    const color = this.options.prettyOptions?.colors?.[level] || DEFAULT_COLORS[level];
    const levelCode = COLORS[color] || COLORS.white;
    const levelStr = `${levelCode}${level.toUpperCase().padEnd(5)}${RESET}`;

    // 3. Metadata (Context, ReqId, WorkerId)
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

    // 4. Message
    const msgStr = `${levelCode}${msg}${RESET}`;

    // 5. Build Line
    const line = `${timeColored} ${levelStr} ${metaStr}${msgStr}`;

    // 6. Output
    if (level === 'error' || level === 'fatal') {
      console.error(line);
    } else {
      console.log(line);
    }

    // 7. Error Stack
    if (err) {
      console.error(err);
    }

    // 8. Additional Data
    if (Object.keys(rest).length > 0) {
      // Check for toLog() support
      const processedRest: any = {};
      for (const [key, val] of Object.entries(rest)) {
        if (val && typeof val === 'object' && 'toLog' in val && typeof (val as any).toLog === 'function') {
          processedRest[key] = (val as any).toLog();
        } else {
          processedRest[key] = val;
        }
      }
      console.log(Bun.inspect(processedRest, { colors: true, depth: 2 })); // Changed depth to 2 to match valid types roughly or just use undefined if Bun allows, but type definition says number.
    }
  }
}
