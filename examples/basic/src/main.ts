import { Bunner, BunnerWebApplication } from '../../../src';
import { bodyParser } from '../../../src/web-application/middlewares/body-parser/body-parser';
import { cors } from '../../../src/web-application/middlewares/cors';
import { AppModule } from './app.module';
import { authCheck, delay, log, shortCircuit, throwError, timeEnd, timeStart } from './core/middlewares/log.middleware';

async function bootstrap() {
  const webApp = await Bunner.createApplication(BunnerWebApplication, AppModule, {
    name: 'basic-app'
  });

  // Global middlewares
  webApp.addGlobalMiddlewares({
    onRequest: [
      cors({ origin: true, credentials: true, exposedHeaders: ['X-Request-Id'] }),
      log('global.onRequest'), [timeStart('req'), timeEnd('req')]
    ],
    beforeHandler: [bodyParser(['json', 'multipart-formdata']), authCheck(), log('global.before')],
    afterHandler: [[delay('global.after.g1', 50), delay('global.after.g2', 30)], log('global.after')],
    afterResponse: [log('global.afterResponse')],
  });

  // Route(glob/regex) middlewares
  webApp.addRouteMiddlewares({
    beforeHandler: {
      '/users/**': log('route.glob.before'),
      're:^/users/\\d+$': log('route.regex.before'),
      're:^/users/short$': shortCircuit('route.short', { short: true }),
    },
    afterHandler: {
      '/users/**': log('route.glob.after'),
      're:^/users/\\d+$': log('route.regex.after'),
      're:^/users/error$': throwError('route.after.error'),
    },
  });

  await webApp.start({
    hostname: '0.0.0.0',
    port: 5000,
  });

  /* 
    setInterval(() => {
      const mem = process.memoryUsage();
      console.log(
        `[메모리 사용량] rss: ${(mem.rss / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB, heapUsed: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`
      );
    }, 1000); */
}

bootstrap();