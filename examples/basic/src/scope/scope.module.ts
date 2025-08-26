import { Module } from '../../../../src';
import { RequestScopedService, TransientService } from './scope.service';

@Module({
  providers: [
    { provide: RequestScopedService, useClass: RequestScopedService, scope: 'Request' },
    { provide: TransientService, useClass: TransientService, scope: 'Transient' },
  ],
  exports: [RequestScopedService, TransientService],
})
export class ScopeModule { }


