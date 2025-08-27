import pino from 'pino';
import type { LoggerInterface } from './interfaces';

export class Logger implements LoggerInterface {
  private static rootLogger: pino.Logger;
  private readonly logger: pino.Logger;

  constructor(name: string) {
    this.logger = Logger.getChild(name);
  }

  static getChild(name: string) {
    if (!this.rootLogger) {
      this.rootLogger = pino({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      });
    }

    return this.rootLogger.child({ name });
  }

  trace(message: string, meta?: Record<string, any>): void {
    this.logger.trace(meta, message);
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(meta, message);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(meta, message);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(meta, message);
  }

  error(message: string, meta?: Record<string, any>): void {
    this.logger.error(meta, message);
  }

  fatal(message: string, meta?: Record<string, any>): void {
    this.logger.fatal(meta, message);
  }
}
