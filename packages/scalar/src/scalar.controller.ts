import { Inject } from '@bunner/common';
import { Controller, Get } from '@bunner/http-adapter';

import { ScalarUiMiddleware } from './scalar-ui.middleware';
import { ScalarService } from './scalar.service';

@Controller()
export class ScalarController {
  constructor(
    private scalarService: ScalarService,
    @Inject('SCALAR_OPTIONS') _options: any,
  ) {}

  @Get('/api-docs')
  getDocs() {
    const spec = this.scalarService.getSpec();
    return new ScalarUiMiddleware(spec, {}).handle({} as any);
  }

  @Get('/api-docs/json')
  getJson() {
    return new Response(JSON.stringify(this.scalarService.getSpec()), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
