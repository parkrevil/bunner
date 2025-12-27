import { BunnerErrorFilter, BunnerMiddleware } from '@bunner/common';
import { describe, expect, it, mock } from 'bun:test';
import { StatusCodes } from 'http-status-codes';

import { createHttpTestHarness, handleRequest, withGlobalMiddlewares } from '../http-test-kit';
import { BunnerHttpContext, type BunnerResponse, HttpMethod } from '../index';

class StopBeforeRequestMiddleware extends BunnerMiddleware {
  handle(ctx: any): boolean {
    const res = ctx.to(BunnerHttpContext).response;

    res.setStatus(StatusCodes.NO_CONTENT);

    return false;
  }
}

class ThrowBeforeRequestMiddleware extends BunnerMiddleware {
  handle(): void {
    throw new Error('beforeRequest failed');
  }
}

class ReturnFalseWithoutWritingMiddleware extends BunnerMiddleware {
  handle(): boolean {
    return false;
  }
}

class MiddlewareController {
  ok(res: BunnerResponse): unknown {
    res.setStatus(StatusCodes.OK);

    return { ok: true };
  }
}

function createRegistry(params: { readonly useScopedMiddleware: any[] }): Map<any, any> {
  const registry = new Map<any, any>();

  registry.set(MiddlewareController, {
    className: 'MiddlewareController',
    decorators: [{ name: 'Controller', arguments: ['mw'] }],
    methods: [
      {
        name: 'ok',
        decorators: [
          { name: 'Get', arguments: ['ok'] },
          { name: 'UseMiddlewares', arguments: params.useScopedMiddleware },
        ],
        parameters: [{ index: 0, name: 'res', type: 'BunnerResponse', decorators: [{ name: 'Res', arguments: [] }] }],
      },
    ],
  });

  return registry;
}

describe('RequestHandler.handle', () => {
  it('should stop when a global beforeRequest middleware returns false', async () => {
    const metadataRegistry = createRegistry({ useScopedMiddleware: [] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ beforeRequest: [new StopBeforeRequestMiddleware()] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.NO_CONTENT);
    expect(workerResponse.body).toBe('');
  });
  it('should default to 204 when a beforeRequest middleware returns false without setting status', async () => {
    const metadataRegistry = createRegistry({ useScopedMiddleware: [] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ beforeRequest: [new ReturnFalseWithoutWritingMiddleware()] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.NO_CONTENT);
    expect(workerResponse.body).toBe('');
  });
  it('should run global beforeRequest middlewares in declaration order', async () => {
    const metadataRegistry = createRegistry({ useScopedMiddleware: [] });
    const calls: string[] = [];

    class FirstMiddleware extends BunnerMiddleware {
      handle(): void {
        calls.push('first');
      }
    }

    class SecondMiddleware extends BunnerMiddleware {
      handle(): void {
        calls.push('second');
      }
    }

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ beforeRequest: [new FirstMiddleware(), new SecondMiddleware()] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });

    await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });
    expect(calls).toEqual(['first', 'second']);
  });
  it('should not execute later beforeRequest middlewares after a previous one returns false', async () => {
    const metadataRegistry = createRegistry({ useScopedMiddleware: [] });
    const calledLater = mock(() => {});

    class StopMiddleware extends BunnerMiddleware {
      handle(): boolean {
        return false;
      }
    }

    class LaterMiddleware extends BunnerMiddleware {
      handle(): void {
        calledLater();
      }
    }

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ beforeRequest: [new StopMiddleware(), new LaterMiddleware()] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });

    await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });
    expect(calledLater).toHaveBeenCalledTimes(0);
  });
  it('should return 500 when a global beforeRequest middleware throws', async () => {
    const metadataRegistry = createRegistry({ useScopedMiddleware: [] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ beforeRequest: [new ThrowBeforeRequestMiddleware()] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });
  it('should run scoped middlewares before handler', async () => {
    const onScoped = mock(() => {});

    class ScopedMiddlewareToken extends BunnerMiddleware {
      handle(): void {
        onScoped();
      }
    }

    const metadataRegistry = createRegistry({ useScopedMiddleware: [ScopedMiddlewareToken] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: ScopedMiddlewareToken, value: new ScopedMiddlewareToken() },
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    expect(onScoped).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });
  it('should ignore scoped middleware tokens that are not registered in the container', async () => {
    class MissingMiddlewareToken extends BunnerMiddleware {
      handle(): void {}
    }

    const metadataRegistry = createRegistry({ useScopedMiddleware: [MissingMiddlewareToken] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: MiddlewareController, value: new MiddlewareController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });
  it('should keep the response when a beforeResponse middleware throws after handler succeeded', async () => {
    class BeforeResponseThrowingMiddleware extends BunnerMiddleware {
      handle(): void {
        throw new Error('beforeResponse failed');
      }
    }

    const metadataRegistry = createRegistry({ useScopedMiddleware: [] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ beforeResponse: [new BeforeResponseThrowingMiddleware() as any] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });
  it('should not invoke ErrorFilters for beforeResponse errors', async () => {
    const onErrorFilter = mock(() => {});

    class GlobalErrorFilter extends BunnerErrorFilter {
      catch(): void {
        onErrorFilter();
      }
    }

    class BeforeRequestStopMiddleware extends BunnerMiddleware {
      handle(): boolean {
        return false;
      }
    }

    class BeforeResponseThrowingMiddleware extends BunnerMiddleware {
      handle(): void {
        throw new Error('beforeResponse failed');
      }
    }

    const metadataRegistry = createRegistry({ useScopedMiddleware: [] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({
          beforeRequest: [new BeforeRequestStopMiddleware()],
          beforeResponse: [new BeforeResponseThrowingMiddleware() as any],
          errorFilters: [new GlobalErrorFilter()],
        }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    expect(onErrorFilter).toHaveBeenCalledTimes(0);
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBeUndefined();
  });
  it('should set status to 500 without setting body when a beforeResponse middleware throws while status is unset', async () => {
    class BeforeRequestStopMiddleware extends BunnerMiddleware {
      handle(): boolean {
        return false;
      }
    }

    class BeforeResponseThrowingMiddleware extends BunnerMiddleware {
      handle(): void {
        throw new Error('beforeResponse failed');
      }
    }

    const metadataRegistry = createRegistry({ useScopedMiddleware: [] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({
          beforeRequest: [new BeforeRequestStopMiddleware() as any],
          beforeResponse: [new BeforeResponseThrowingMiddleware() as any],
        }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBeUndefined();
  });
  it('should keep the response when an afterResponse middleware throws', async () => {
    class AfterResponseThrowingMiddleware extends BunnerMiddleware {
      handle(): void {
        throw new Error('afterResponse failed');
      }
    }

    const metadataRegistry = createRegistry({ useScopedMiddleware: [] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ afterResponse: [new AfterResponseThrowingMiddleware() as any] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });
  it('should not invoke ErrorFilters for afterResponse errors', async () => {
    const onErrorFilter = mock(() => {});

    class GlobalErrorFilter extends BunnerErrorFilter {
      catch(): void {
        onErrorFilter();
      }
    }

    class AfterResponseThrowingMiddleware extends BunnerMiddleware {
      handle(): void {
        throw new Error('afterResponse failed');
      }
    }

    const metadataRegistry = createRegistry({ useScopedMiddleware: [] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({
          afterResponse: [new AfterResponseThrowingMiddleware() as any],
          errorFilters: [new GlobalErrorFilter()],
        }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    expect(onErrorFilter).toHaveBeenCalledTimes(0);
    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });
});
