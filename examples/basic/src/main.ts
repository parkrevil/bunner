import { Bunner, BunnerWebApplication } from '../../../src';
import { AppModule } from './app.module';

async function bootstrap() {
  const webApp = await Bunner.createApplication(BunnerWebApplication, AppModule, {
    name: 'basic-app'
  });

  await webApp.start({
    hostname: '0.0.0.0',
    port: 5000,
  });


  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(
      `[메모리 사용량] rss: ${(mem.rss / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB, heapUsed: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`
    );
  }, 1000);
}

bootstrap();