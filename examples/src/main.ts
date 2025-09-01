import { Bunner, metadataRegistry } from '@bunner/core';
import { HttpServer } from '@bunner/http-server';
import { RootModule } from './root.module';
import { Logger } from '@bunner/core-logger';

async function bootstrap() {
  const app = await Bunner.createApplication(HttpServer, RootModule);
  const logger = await Logger.getInstance();
  
  logger.init();

  logger.info('🚀 Server is starting...');

  app.start();

  logger.info('🚀 Server is running on port 5000');
}

bootstrap();
