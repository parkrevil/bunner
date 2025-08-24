import { Inject, Injectable, forwardRef } from '../../../../../src';
import { ProductsService } from '../products/products.service';

@Injectable()
export class CatalogService {
  constructor(@Inject(forwardRef(() => ProductsService)) private readonly products: ProductsService) { }

  getCatalogHighlight() {
    return this.products.getFeaturedProduct();
  }
}
