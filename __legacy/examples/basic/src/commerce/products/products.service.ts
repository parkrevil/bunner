import { Injectable } from '../../../../../src';

@Injectable()
export class ProductsService {
  getFeaturedProduct() {
    return { id: 'p-100', name: 'Featured Product' };
  }
}
