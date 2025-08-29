import { Module } from '../../../src';
import { OrdersModule } from './commerce/orders/orders.module';
import { ConfigModuleFactory } from './config/config.module';
import { FeatureModuleFactory } from './feature/feature.module';
import { ScopeModule } from './scope/scope.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    UsersModule,
    () => OrdersModule,
    ScopeModule,
    // forRoot
    ConfigModuleFactory.forRoot({ name: 'basic-app', version: '1.0.0' }),
    // forRootAsync
    ConfigModuleFactory.forRootAsync(async () => ({ name: 'basic-app-async', version: '1.0.1' })),
    // forFeature
    FeatureModuleFactory.forFeature(),
    // forFeatureAsync
    FeatureModuleFactory.forFeatureAsync(),
  ]
})
export class AppModule { }
