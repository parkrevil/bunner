import { Inject, Injectable, LazyServiceIdentifier } from '../../../../../src';
import { CatalogService } from '../catalog/catalog.service';

@Injectable()
export class OrdersService {
  constructor(@Inject(new LazyServiceIdentifier(() => CatalogService)) private readonly catalog: CatalogService) { }

  createOrder() {
    const item = this.catalog.getCatalogHighlight();
    return { orderId: 'o-1', item };
  }
}
