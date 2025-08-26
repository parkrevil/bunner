import { Inject, Injectable, LazyServiceIdentifier } from '../../../../../src';
import { ProductsService } from '../products/products.service';

@Injectable()
export class CatalogService {
  constructor(@Inject(new LazyServiceIdentifier(() => ProductsService)) private readonly products: ProductsService) { }

  getCatalogHighlight() {
    return this.products.getFeaturedProduct();
  }
}
