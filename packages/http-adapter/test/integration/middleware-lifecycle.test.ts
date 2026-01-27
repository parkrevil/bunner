import type { Context } from '@bunner/common';

import { BunnerErrorFilter, BunnerMiddleware } from '@bunner/common';
import { describe, expect, it, mock } from 'bun:test';
import { StatusCodes } from 'http-status-codes';

import type { ClassMetadata, DecoratorArgument, MetadataRegistryKey } from '../../src/types';

import { createHttpTestHarness, handleRequest, withGlobalMiddlewares } from '../http-test-kit';
import { BunnerHttpContext, type BunnerResponse, HttpMethod } from '../index';

class StopBeforeRequestMiddleware extends BunnerMiddleware {
  handle(ctx: Context): boolean {
    const res = assertHttpContext(ctx).response;

    res.setStatus(StatusCodes.NO_CONTENT);

    return false;
  }
}

function assertHttpContext(ctx: Context): BunnerHttpContext {
  if (ctx instanceof BunnerHttpContext) {
    return ctx;
  }

  throw new Error('Expected BunnerHttpContext');
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
  ok(res: BunnerResponse): Record<string, boolean> {
    res.setStatus(StatusCodes.OK);

    return { ok: true };
  }
}

function createRegistry(useScopedMiddleware: readonly DecoratorArgument[]): Map<MetadataRegistryKey, ClassMetadata> {
  const registry = new Map<MetadataRegistryKey, ClassMetadata>();

  registry.set(MiddlewareController, {
    className: 'MiddlewareController',
    decorators: [{ name: 'RestController', arguments: ['mw'] }],
    methods: [
      {
        name: 'ok',
        decorators: [
          { name: 'Get', arguments: ['ok'] },
          { name: 'UseMiddlewares', arguments: useScopedMiddleware },
        ],
        parameters: [{ index: 0, name: 'res', type: 'BunnerResponse', decorators: [{ name: 'Res', arguments: [] }] }],
      },
    ],
  });

  return registry;
}

describe('RequestHandler.handle', () => {
  it('should stop when a global beforeRequest middleware returns false', async () => {
    // Arrange
    const metadataRegistry = createRegistry([]);
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ beforeRequest: [new StopBeforeRequestMiddleware()] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(workerResponse.init.status).toBe(StatusCodes.NO_CONTENT);
    expect(workerResponse.body).toBe('');
  });

  it('should default to 204 when a beforeRequest middleware returns false without setting status', async () => {
    // Arrange
    const metadataRegistry = createRegistry([]);
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ beforeRequest: [new ReturnFalseWithoutWritingMiddleware()] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(workerResponse.init.status).toBe(StatusCodes.NO_CONTENT);
    expect(workerResponse.body).toBe('');
  });

  it('should run global beforeRequest middlewares in declaration order when handling a request', async () => {
    // Arrange
    const metadataRegistry = createRegistry([]);
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

    // Act
    await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(calls).toEqual(['first', 'second']);
  });

  it('should not execute later beforeRequest middlewares when a previous one returns false', async () => {
    // Arrange
    const metadataRegistry = createRegistry([]);
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

    // Act
    await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(calledLater).toHaveBeenCalledTimes(0);
  });

  it('should return 500 when a global beforeRequest middleware throws', async () => {
    // Arrange
    const metadataRegistry = createRegistry([]);
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ beforeRequest: [new ThrowBeforeRequestMiddleware()] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should run scoped middlewares before handler when registered', async () => {
    // Arrange
    const onScoped = mock(() => {});

    class ScopedMiddlewareToken extends BunnerMiddleware {
      handle(): void {
        onScoped();
      }
    }

    const metadataRegistry = createRegistry([ScopedMiddlewareToken]);
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: ScopedMiddlewareToken, value: new ScopedMiddlewareToken() },
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(onScoped).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });

  it('should ignore scoped middleware tokens when they are not registered in the container', async () => {
    // Arrange
    class MissingMiddlewareToken extends BunnerMiddleware {
      handle(): void {}
    }

    const metadataRegistry = createRegistry([MissingMiddlewareToken]);
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: MiddlewareController, value: new MiddlewareController() }],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });

  it('should keep the response when a beforeResponse middleware throws after handler succeeded', async () => {
    // Arrange
    class BeforeResponseThrowingMiddleware extends BunnerMiddleware {
      handle(): void {
        throw new Error('beforeResponse failed');
      }
    }

    const metadataRegistry = createRegistry([]);
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ beforeResponse: [new BeforeResponseThrowingMiddleware()] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });

  it('should not invoke ErrorFilters when beforeResponse errors occur', async () => {
    // Arrange
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

    const metadataRegistry = createRegistry([]);
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({
          beforeRequest: [new BeforeRequestStopMiddleware()],
          beforeResponse: [new BeforeResponseThrowingMiddleware()],
          errorFilters: [new GlobalErrorFilter()],
        }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(onErrorFilter).toHaveBeenCalledTimes(0);
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBeNull();
  });

  it('should set status to 500 without setting body when a beforeResponse middleware throws while status is unset', async () => {
    // Arrange
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

    const metadataRegistry = createRegistry([]);
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({
          beforeRequest: [new BeforeRequestStopMiddleware()],
          beforeResponse: [new BeforeResponseThrowingMiddleware()],
        }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBeNull();
  });

  it('should keep the response when an afterResponse middleware throws', async () => {
    // Arrange
    class AfterResponseThrowingMiddleware extends BunnerMiddleware {
      handle(): void {
        throw new Error('afterResponse failed');
      }
    }

    const metadataRegistry = createRegistry([]);
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ afterResponse: [new AfterResponseThrowingMiddleware()] }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });

  it('should not invoke ErrorFilters when afterResponse errors occur', async () => {
    // Arrange
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

    const metadataRegistry = createRegistry([]);
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({
          afterResponse: [new AfterResponseThrowingMiddleware()],
          errorFilters: [new GlobalErrorFilter()],
        }),
        { token: MiddlewareController, value: new MiddlewareController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/mw/ok',
      url: 'http://localhost/mw/ok',
    });

    // Assert
    expect(onErrorFilter).toHaveBeenCalledTimes(0);
    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });
});
