import { Bunner } from '../../../src';
import { AppModule } from './app.module';

const webApp = Bunner.createWebApplication(AppModule, {
  name: 'basic-app'
});

webApp.start({
  port: 4000,
});


setInterval(() => {
  const mem = process.memoryUsage();
  console.log(
    `[메모리 사용량] rss: ${(mem.rss / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB, heapUsed: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`
  );
}, 1000);
