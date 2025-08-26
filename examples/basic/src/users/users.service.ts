import { Inject, Injectable, LazyServiceIdentifier, type OnModuleInit } from '../../../../src';
import { AnalyticsService } from '../analytics/analytics.service';
import { OrdersService } from '../commerce/orders/orders.service';

@Injectable()
export class UsersService implements OnModuleInit {
  private users = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
    },

    {
      id: 2,
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    },
    {
      id: 3,
      name: 'John Smith',
      email: 'john.smith@example.com',
    },
  ];

  constructor(
    @Inject(new LazyServiceIdentifier(() => AnalyticsService)) private readonly analyticsService: AnalyticsService,
    @Inject(new LazyServiceIdentifier(() => OrdersService)) private readonly ordersService: OrdersService,
  ) { }

  onModuleInit() {
    console.log('UsersService initialized');
  }

  getList() {
    this.analyticsService.trackEvent(0, 'getList');
    return this.users;
  }

  getById(id: number) {
    this.analyticsService.trackEvent(id, 'getById');
    return this.users.find((user) => user.id === id);
  }

  create() {
    this.analyticsService.trackEvent(0, 'create');
    const order = this.ordersService.createOrder();
    return { created: true, order };
  }

  delete(id: number) {
    this.analyticsService.trackEvent(id, 'delete');
    return this.users.splice(this.users.findIndex((user) => user.id === id), 1);
  }
}
