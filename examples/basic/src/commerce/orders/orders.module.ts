import { Module, forwardRef } from '../../../../../src';
import { CatalogModule } from '../catalog/catalog.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [forwardRef(() => CatalogModule)],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService, CatalogModule],
})
export class OrdersModule { }
