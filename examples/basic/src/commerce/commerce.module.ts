import { Module, forwardRef } from '../../../../src';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)],
})
export class CommerceAppModule { }
