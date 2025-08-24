import { Bunner } from '../../../src';
import { AppModule } from './app.module';

const webApp = Bunner.createWebApplication(AppModule, {
  name: 'basic-app'
});

webApp.start({
  port: 4000,
});
