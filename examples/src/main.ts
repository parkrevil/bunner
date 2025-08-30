import { Bunner } from '@bunner/core';
import { HttpServer } from '@bunner/http-server';
import { RootModule } from './root.module';

async function bootstrap() {
  const app = await Bunner.createApplication(HttpServer, RootModule);

  app.start();

  console.log('Server is running on port 5000');
}

bootstrap();
