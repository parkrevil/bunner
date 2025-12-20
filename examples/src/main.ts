import { Bunner, LogLevel } from '@bunner/core';
import { BunnerHttpServer } from '@bunner/http-server';
import { Logger } from '@bunner/logger';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await Bunner.create(BunnerHttpServer, AppModule, {
    logLevel: LogLevel.Debug,
    workers: 1,
    queueCapacity: 8192,
    port: 5002,
  });

  logger.info('🚀 Server is starting...');

  await app.start();

  logger.info('🚀 Server is running on port 5001');

  setInterval(() => {
    const mem = process.memoryUsage();
    logger.debug(
      `rss: ${(mem.rss / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB, heapUsed: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`,
    );
  }, 5000);
}

bootstrap().catch(err => {
  const logger = new Logger('Bootstrap');
  logger.error('Bootstrap error', err);
});
