import { describe, expect, it, mock } from 'bun:test';
import { StatusCodes } from 'http-status-codes';

import { createHttpTestHarness, handleRequest, withGlobalMiddlewares } from '../http-test-kit';
import { BunnerHttpContext, type BunnerResponse, HttpMethod, type SystemErrorHandler } from '../index';

class SystemController {
  boom(): void {
    throw new Error('boom');
  }

  ok(res: BunnerResponse): unknown {
    res.setStatus(StatusCodes.OK);

    return { ok: true };
  }
}

function createRegistry(): Map<any, any> {
  const registry = new Map<any, any>();

  registry.set(SystemController, {
    className: 'SystemController',
    decorators: [{ name: 'Controller', arguments: ['sys'] }],
    methods: [
      { name: 'boom', decorators: [{ name: 'Get', arguments: ['boom'] }], parameters: [] },
      {
        name: 'ok',
        decorators: [{ name: 'Get', arguments: ['ok'] }],
        parameters: [{ index: 0, name: 'res', type: 'BunnerResponse', decorators: [{ name: 'Res', arguments: [] }] }],
      },
    ],
  });

  return registry;
}

describe('RequestHandler.handle', () => {
  it('should call SystemErrorHandler when status is unset after ErrorFilters', async () => {
    const metadataRegistry = createRegistry();
    const onCall = mock(() => {});
    const systemErrorHandler: SystemErrorHandler = {
      handle(_error: unknown, ctx: any): Promise<void> {
        onCall();

        const http = ctx.to(BunnerHttpContext);

        http.response.setStatus(StatusCodes.INTERNAL_SERVER_ERROR);
        http.response.setBody('system');

        return Promise.resolve();
      },
    };
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({ systemErrorHandler }), { token: SystemController, value: new SystemController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/sys/boom',
      url: 'http://localhost/sys/boom',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('system');
  });

  it('should fall back to DefaultErrorHandler when SystemErrorHandler throws', async () => {
    const metadataRegistry = createRegistry();
    const onCall = mock(() => {});
    const systemErrorHandler: SystemErrorHandler = {
      handle(): Promise<void> {
        onCall();

        return Promise.reject(new Error('system failed'));
      },
    };
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({ systemErrorHandler }), { token: SystemController, value: new SystemController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/sys/boom',
      url: 'http://localhost/sys/boom',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should call SystemErrorHandler at most once per request', async () => {
    const metadataRegistry = createRegistry();
    const onCall = mock(() => {});
    const systemErrorHandler: SystemErrorHandler = {
      handle(_error: unknown, ctx: any): Promise<void> {
        onCall();

        const http = ctx.to(BunnerHttpContext);

        http.response.setStatus(StatusCodes.INTERNAL_SERVER_ERROR);
        http.response.setBody('system');

        return Promise.resolve();
      },
    };

    class BeforeResponseThrowingMiddleware {
      handle(): Promise<void> {
        return Promise.reject(new Error('beforeResponse failed'));
      }
    }

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({
          systemErrorHandler,
          beforeResponse: [new BeforeResponseThrowingMiddleware() as any],
        }),
        { token: SystemController, value: new SystemController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/sys/boom',
      url: 'http://localhost/sys/boom',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('system');
  });

  it('should not call SystemErrorHandler for afterResponse middleware errors', async () => {
    const metadataRegistry = createRegistry();
    const onCall = mock(() => {});
    const systemErrorHandler: SystemErrorHandler = {
      handle(_error: unknown, ctx: any): Promise<void> {
        onCall();

        const http = ctx.to(BunnerHttpContext);

        http.response.setStatus(StatusCodes.INTERNAL_SERVER_ERROR);
        http.response.setBody('system');

        return Promise.resolve();
      },
    };

    class AfterResponseThrowingMiddleware {
      handle(): Promise<void> {
        return Promise.reject(new Error('afterResponse failed'));
      }
    }

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ afterResponse: [new AfterResponseThrowingMiddleware() as any], systemErrorHandler }),
        { token: SystemController, value: new SystemController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/sys/ok',
      url: 'http://localhost/sys/ok',
    });

    expect(onCall).toHaveBeenCalledTimes(0);
    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });
});
