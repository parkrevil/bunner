import { Module } from '../../../../../src';
import { CatalogModule } from '../catalog/catalog.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [() => CatalogModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService, CatalogModule],
})
export class OrdersModule { }
