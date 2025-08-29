import { Bunner } from '@bunner/core';
import { HttpServer } from '@bunner/http-server';

class AppModule {}

async function bootstrap() {
  const app = await Bunner.createApplication(HttpServer, AppModule);

  app.start();

  console.log('Server is running on port 5000');
}

bootstrap();
