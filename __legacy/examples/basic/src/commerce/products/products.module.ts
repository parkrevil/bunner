import { Module } from '../../../../../src';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule { }
