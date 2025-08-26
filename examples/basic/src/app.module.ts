import { Module } from '../../../src';
import { OrdersModule } from './commerce/orders/orders.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [UsersModule, () => OrdersModule]
})
export class AppModule { }
