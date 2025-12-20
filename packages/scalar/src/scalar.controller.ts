import { Controller, Inject } from '@bunner/core';
import { Get } from '@bunner/http-server';
import { ScalarService } from './scalar.service';
import { ScalarUiMiddleware } from './scalar-ui.middleware';

@Controller()
export class ScalarController {
  constructor(
    private scalarService: ScalarService,
    @Inject('SCALAR_OPTIONS') _options: any
  ) { }

  getDocs() {
    const spec = this.scalarService.getSpec();
    return new ScalarUiMiddleware(spec, {}).handle({} as any);
  }

  @Get('/api-docs/json')
  getJson() {
    return new Response(JSON.stringify(this.scalarService.getSpec()), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}