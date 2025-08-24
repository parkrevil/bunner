import { Get, RestController } from '../../../../../src';
import { OrdersService } from './orders.service';

@RestController('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) { }

  @Get('create')
  create() {
    return this.orders.createOrder();
  }
}
