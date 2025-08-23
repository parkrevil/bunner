import { Bunner } from '../../../src';

const webApp = Bunner.createWebApplication({
});

webApp.start({
  port: 4000,
});

console.log(Bunner.getApplications());