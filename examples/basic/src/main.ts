import { Bunner } from '../../../src';
import { UsersController } from './users';

const webApp = Bunner.createWebApplication({
  controllers: [UsersController],
});

webApp.start({
  port: 4000,
});
