import { Get, RestController } from '../../../../../src';
import { ProductsService } from './products.service';

@RestController('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) { }

  @Get('featured')
  getFeatured() {
    return this.products.getFeaturedProduct();
  }
}
