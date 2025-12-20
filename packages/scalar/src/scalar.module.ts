import { Module, type DynamicModule } from '@bunner/core';

import { ScalarController } from './scalar.controller';
import { ScalarService } from './scalar.service';

export interface ScalarModuleOptions {
  type?: 'openapi' | 'asyncapi';
  path?: string;
  title?: string;
  version?: string;
}

@Module({
  controllers: [ScalarController],
  providers: [ScalarService, { provide: 'SCALAR_OPTIONS', useValue: {} }],
})
export class ScalarModule {
  static forRoot(options: ScalarModuleOptions): DynamicModule {
    return {
      module: ScalarModule,
      providers: [
        {
          provide: 'SCALAR_OPTIONS',
          useValue: options,
        },
        ScalarService,
      ],
      controllers: [ScalarController],
    };
  }
}
