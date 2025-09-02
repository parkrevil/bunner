import { Bunner } from '@bunner/core';
import { HttpServer } from '@bunner/http-server';
import { Logger } from '@bunner/core-logger';
import { RootModule } from './root.module';

async function bootstrap() {
  const app = await Bunner.create(HttpServer, RootModule);
  const logger = await Logger.getInstance();
  
  logger.init();

  logger.info('🚀 Server is starting...');

  app.start();

  logger.info('🚀 Server is running on port 5000');

  setInterval(() => {
    const mem = process.memoryUsage();
    logger.info(
      `rss: ${(mem.rss / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB, heapUsed: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`
    );
  }, 1000);
}

bootstrap();
