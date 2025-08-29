import { Get, RestController } from '../../../../../src';
import { CatalogService } from './catalog.service';

@RestController('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) { }

  @Get('highlight')
  highlight() {
    return this.catalog.getCatalogHighlight();
  }
}
