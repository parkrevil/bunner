import { Module, forwardRef } from '../../../../../src';
import { ProductsModule } from '../products/products.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [forwardRef(() => ProductsModule)],
  providers: [CatalogService],
  controllers: [CatalogController],
  exports: [CatalogService, ProductsModule],
})
export class CatalogModule { }
