import { Module } from '../../../../src';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [OrdersModule],
})
export class CommerceAppModule { }
