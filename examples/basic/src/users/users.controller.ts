import type { OnApplicationShutdown, OnModuleInit } from '../../../../src';
import { Delete, Get, Inject, LazyServiceIdentifier, Post, RestController } from '../../../../src';
import { log } from '../core/middlewares/log.middleware';
import { FEATURE_TOKEN } from '../feature/feature.module';
import { RequestScopedService, TransientService } from '../scope/scope.service';
import { UsersService } from './users.service';

@RestController('users', {
  middlewares: {
    beforeHandler: [log('controller.before')],
    afterHandler: [log('controller.after')],
  }
})
export class UsersController implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(new LazyServiceIdentifier(() => UsersService)) private readonly usersService: UsersService,
    @Inject(FEATURE_TOKEN) private readonly feature: any,
    @Inject(Symbol.for('Factory:ref:RequestScopedService')) private readonly getRequestSvc: () => RequestScopedService,
    @Inject(Symbol.for('Factory:ref:TransientService')) private readonly getTransient: () => TransientService,
  ) { }

  onModuleInit() {
    console.log('UsersController initialized');
  }

  onApplicationShutdown() {
    console.log('UsersController shutdown');
  }

  @Get('/', {
    middlewares: {
      beforeHandler: [[log('handler.before.a'), log('handler.before.b')]],
      afterHandler: [[log('handler.after.a'), log('handler.after.b')]],
    },
  })
  getList() {
    const req1 = this.getRequestSvc();
    const req2 = this.getRequestSvc();
    const tr1 = this.getTransient();
    const tr2 = this.getTransient();

    return {
      users: this.usersService.getList(),
      feature: this.feature?.info?.(),
      requestIds: [req1.id, req2.id],
      transientIds: [tr1.id, tr2.id],
    };
  }

  @Get(':id', {
    middlewares: {
      beforeHandler: [log('handler.before.getById')],
      afterHandler: [log('handler.after.getById')],
    }
  })
  getById() {
    return this.usersService.getById(1);
  }

  @Post('')
  create() {
    return this.usersService.create();
  }

  @Delete(':id')
  delete() {
    return this.usersService.delete(1);
  }

  @Get('short')
  getShort() {
    return { short: false };
  }

  @Get('error')
  getError() {
    return { ok: true };
  }
}
