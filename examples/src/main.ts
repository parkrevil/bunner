import { Bunner, LogLevel } from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import { BunnerHttpServer } from '@bunner/http-server';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await Bunner.create(BunnerHttpServer, AppModule, {
    logLevel: LogLevel.Trace,
    workers: 1,
    queueCapacity: 8192,
    port: 5000,
  });
  const logger = Logger.getInstance();

  logger.init();

  logger.info('🚀 Server is starting...');

  await app.start();

  logger.info('🚀 Server is running on port 5000');

  setInterval(() => {
    const mem = process.memoryUsage();
    logger.info(
      `rss: ${(mem.rss / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB, heapUsed: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`,
    );
  }, 5000);
}

bootstrap().catch(console.error);
