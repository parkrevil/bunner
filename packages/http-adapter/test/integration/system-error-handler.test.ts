import type { Context } from '@bunner/common';

import { describe, expect, it, mock } from 'bun:test';
import { StatusCodes } from 'http-status-codes';

import type { ClassMetadata, ControllerConstructor, SystemError } from '../types';

import { createHttpTestHarness, handleRequest, withGlobalMiddlewares } from '../http-test-kit';
import { BunnerHttpContext, type BunnerResponse, HttpMethod } from '../index';
import { SystemErrorHandler } from '../system-error-handler';

class SystemController {
  boom(): void {
    throw new Error('boom');
  }

  ok(res: BunnerResponse): Record<string, boolean> {
    res.setStatus(StatusCodes.OK);

    return { ok: true };
  }
}

function createRegistry(): Map<ControllerConstructor, ClassMetadata> {
  const registry = new Map<ControllerConstructor, ClassMetadata>();

  registry.set(SystemController, {
    className: 'SystemController',
    decorators: [{ name: 'RestController', arguments: ['sys'] }],
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
    // Arrange
    const metadataRegistry = createRegistry();
    const onCall = mock(() => {});

    class TestSystemErrorHandler extends SystemErrorHandler {
      async handle(_error: SystemError, ctx: Context): Promise<void> {
        onCall();

        const http = ctx.to(BunnerHttpContext);

        http.response.setStatus(StatusCodes.INTERNAL_SERVER_ERROR);
        http.response.setBody('system');
      }
    }

    const systemErrorHandler = new TestSystemErrorHandler();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({ systemErrorHandler }), { token: SystemController, value: new SystemController() }],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/sys/boom',
      url: 'http://localhost/sys/boom',
    });

    // Assert
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('system');
  });

  it('should fall back to DefaultErrorHandler when SystemErrorHandler throws', async () => {
    // Arrange
    const metadataRegistry = createRegistry();
    const onCall = mock(() => {});

    class TestSystemErrorHandler extends SystemErrorHandler {
      async handle(): Promise<void> {
        onCall();

        return Promise.reject(new Error('system failed'));
      }
    }

    const systemErrorHandler = new TestSystemErrorHandler();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({ systemErrorHandler }), { token: SystemController, value: new SystemController() }],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/sys/boom',
      url: 'http://localhost/sys/boom',
    });

    // Assert
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should call SystemErrorHandler at most once per request when handling errors', async () => {
    // Arrange
    const metadataRegistry = createRegistry();
    const onCall = mock(() => {});

    class TestSystemErrorHandler extends SystemErrorHandler {
      async handle(_error: SystemError, ctx: Context): Promise<void> {
        onCall();

        const http = ctx.to(BunnerHttpContext);

        http.response.setStatus(StatusCodes.INTERNAL_SERVER_ERROR);
        http.response.setBody('system');
      }
    }

    const systemErrorHandler = new TestSystemErrorHandler();

    class BeforeResponseThrowingMiddleware {
      async handle(): Promise<void> {
        return Promise.reject(new Error('beforeResponse failed'));
      }
    }

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({
          systemErrorHandler,
          beforeResponse: [new BeforeResponseThrowingMiddleware()],
        }),
        { token: SystemController, value: new SystemController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/sys/boom',
      url: 'http://localhost/sys/boom',
    });

    // Assert
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('system');
  });

  it('should not call SystemErrorHandler when afterResponse middleware errors occur', async () => {
    // Arrange
    const metadataRegistry = createRegistry();
    const onCall = mock(() => {});

    class TestSystemErrorHandler extends SystemErrorHandler {
      async handle(_error: SystemError, ctx: Context): Promise<void> {
        onCall();

        const http = ctx.to(BunnerHttpContext);

        http.response.setStatus(StatusCodes.INTERNAL_SERVER_ERROR);
        http.response.setBody('system');
      }
    }

    const systemErrorHandler = new TestSystemErrorHandler();

    class AfterResponseThrowingMiddleware {
      async handle(): Promise<void> {
        return Promise.reject(new Error('afterResponse failed'));
      }
    }

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ afterResponse: [new AfterResponseThrowingMiddleware()], systemErrorHandler }),
        { token: SystemController, value: new SystemController() },
      ],
    });
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/sys/ok',
      url: 'http://localhost/sys/ok',
    });

    // Assert
    expect(onCall).toHaveBeenCalledTimes(0);
    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });
});
