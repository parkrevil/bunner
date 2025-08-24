import { Module, forwardRef } from '../../../src';
import { OrdersModule } from './commerce/orders/orders.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [UsersModule, forwardRef(() => OrdersModule)]
})
export class AppModule { }
