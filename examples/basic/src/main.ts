import { Bunner, BunnerWebApplication } from '../../../src';
import { Logger } from '../../../src/providers/logger';
import { bodyLimiter } from '../../../src/web-application/middlewares/body-limiter';
import { bodyParser } from '../../../src/web-application/middlewares/body-parser';
import { compression } from '../../../src/web-application/middlewares/compression';
import { cookieParser } from '../../../src/web-application/middlewares/cookie-parser';
import { cors } from '../../../src/web-application/middlewares/cors';
import { csrf } from '../../../src/web-application/middlewares/csrf';
import { helmet } from '../../../src/web-application/middlewares/helmet';
import { hpp } from '../../../src/web-application/middlewares/hpp/hpp';
import { requestId } from '../../../src/web-application/middlewares/request-id';
import { AppModule } from './app.module';
import { authCheck, delay, log, shortCircuit, throwError, timeEnd, timeStart } from './core/middlewares/log.middleware';

async function bootstrap() {
  const webApp = await Bunner.createApplication(BunnerWebApplication, AppModule, {
    name: 'basic-app'
  });

  const logger = new Logger('main');
  logger.info('Starting Bunner basic application...');

  webApp.addGlobalMiddlewares({
    onRequest: [
      requestId(),
      cookieParser(),
      bodyLimiter({ maxBytes: 1024 * 1024 }),
      hpp(),
      helmet(),
      cors({ origin: true, credentials: true, exposedHeaders: ['X-Request-Id'] }),
      log('global.onRequest'), [timeStart('req'), timeEnd('req')]
    ],
    beforeHandler: [bodyParser(['json', 'multipart-formdata']), csrf(), authCheck(), log('global.before')],
    afterHandler: [
      compression({
        thresholds: {
          thresholdBytes: 0,
          minRatio: 0.8,
          smallStringBytes: 0,
          sampleBytes: 0,
        },
      }),
      [delay('global.after.g1', 50), delay('global.after.g2', 30)],
      log('global.after')
    ],
    afterResponse: [log('global.afterResponse')],
  });

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

  setInterval(() => {
    const mem = process.memoryUsage();
    logger.info(
      `[메모리 사용량] rss: ${(mem.rss / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB, heapUsed: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`
    );
  }, 1000);
}

bootstrap();