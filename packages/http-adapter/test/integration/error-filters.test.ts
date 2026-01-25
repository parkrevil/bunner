import type { Context } from '@bunner/common';

import { BunnerErrorFilter } from '@bunner/common';
import { Container, registerRuntimeContext } from '@bunner/core';
import { describe, expect, it, mock } from 'bun:test';
import { StatusCodes } from 'http-status-codes';

import type {
  ClassMetadata,
  ControllerConstructor,
  DecoratorMetadata,
  MetadataRegistryKey,
  RouteHandlerArgument,
  RouteHandlerFunction,
  RouteHandlerResult,
  RouteHandlerValue,
  SystemError,
} from '../../src/types';
import type { ErrorFilterRegistryParams } from './types';

import { BunnerHttpAdapter } from '../../index';
import { createHttpTestHarness, createRequest, createResponse, handleRequest, withGlobalMiddlewares } from '../http-test-kit';
import { BunnerHttpContext, BunnerResponse, HttpMethod, RequestHandler, RouteHandler } from '../index';

class ErrorController {
  [key: string]: RouteHandlerValue | RouteHandlerFunction;

  boom(..._args: readonly RouteHandlerArgument[]): RouteHandlerResult {
    throw new Error('boom');
  }

  boomBoxedString(..._args: readonly RouteHandlerArgument[]): RouteHandlerResult {
    throw new Error('boxed', { cause: new String('boxed') });
  }

  boomBoxedNumber(..._args: readonly RouteHandlerArgument[]): RouteHandlerResult {
    throw new Error('boxed-number', { cause: new Number(123) });
  }

  boomBoolean(..._args: readonly RouteHandlerArgument[]): RouteHandlerResult {
    throw new Error('boom-boolean', { cause: true });
  }

  boomLiteral(..._args: readonly RouteHandlerArgument[]): RouteHandlerResult {
    throw new Error('LITERAL', { cause: 'LITERAL' });
  }

  boomString(..._args: readonly RouteHandlerArgument[]): RouteHandlerResult {
    throw new Error('boom', { cause: 'boom' });
  }

  boomNumber(..._args: readonly RouteHandlerArgument[]): RouteHandlerResult {
    throw new Error('boom-number', { cause: 123 });
  }

  ok(...args: readonly RouteHandlerArgument[]): RouteHandlerResult {
    const [response] = args;

    if (response instanceof BunnerResponse) {
      response.setStatus(StatusCodes.OK);
    }

    return { ok: true };
  }
}

function isControllerConstructor(token: MetadataRegistryKey, metadata: ClassMetadata): token is ControllerConstructor {
  if (typeof token !== 'function') {
    return false;
  }

  const decorators = metadata.decorators ?? [];

  return decorators.some((decorator: DecoratorMetadata) => {
    const decoratorName = decorator.name;

    return decoratorName === 'Controller' || decoratorName === 'RestController';
  });
}

function createControllerRegistry(registry: Map<MetadataRegistryKey, ClassMetadata>): Map<ControllerConstructor, ClassMetadata> {
  const controllerRegistry = new Map<ControllerConstructor, ClassMetadata>();

  for (const [token, metadata] of registry.entries()) {
    if (isControllerConstructor(token, metadata)) {
      controllerRegistry.set(token, metadata);
    }
  }

  return controllerRegistry;
}

function assertHttpContext(ctx: Context): BunnerHttpContext {
  if (ctx instanceof BunnerHttpContext) {
    return ctx;
  }

  throw new Error('Expected BunnerHttpContext');
}

class SetStatusFilter extends BunnerErrorFilter {
  private onCall: (() => void) | undefined;

  setOnCall(onCall: () => void): void {
    this.onCall = onCall;
  }

  catch(_error: Parameters<BunnerErrorFilter['catch']>[0], context: Context): void {
    this.onCall?.();

    const http = assertHttpContext(context);

    http.response.setStatus(StatusCodes.IM_A_TEAPOT);
    http.response.setBody({ filtered: true });
  }
}

class RethrowFilter extends BunnerErrorFilter {
  catch(): void {
    throw new Error('next');
  }
}

class CatchStringFilter extends BunnerErrorFilter {
  private onCall: (() => void) | undefined;

  setOnCall(onCall: () => void): void {
    this.onCall = onCall;
  }

  catch(_error: Parameters<BunnerErrorFilter['catch']>[0], context: Context): void {
    this.onCall?.();

    const http = assertHttpContext(context);

    http.response.setStatus(StatusCodes.BAD_REQUEST);
    http.response.setBody('caught-string');
  }
}

class CatchLiteralFilter extends BunnerErrorFilter {
  private onCall: (() => void) | undefined;

  setOnCall(onCall: () => void): void {
    this.onCall = onCall;
  }

  catch(_error: Parameters<BunnerErrorFilter['catch']>[0], context: Context): void {
    this.onCall?.();

    const http = assertHttpContext(context);

    http.response.setStatus(StatusCodes.CONFLICT);
    http.response.setBody('caught-literal');
  }
}

class CatchNumberFilter extends BunnerErrorFilter {
  private onCall: (() => void) | undefined;

  setOnCall(onCall: () => void): void {
    this.onCall = onCall;
  }

  catch(_error: Parameters<BunnerErrorFilter['catch']>[0], context: Context): void {
    this.onCall?.();

    const http = assertHttpContext(context);

    http.response.setStatus(StatusCodes.UNPROCESSABLE_ENTITY);
    http.response.setBody('caught-number');
  }
}

function createRegistry(params: ErrorFilterRegistryParams): Map<MetadataRegistryKey, ClassMetadata> {
  const registry = new Map<MetadataRegistryKey, ClassMetadata>();

  registry.set(ErrorController, {
    className: 'ErrorController',
    decorators: [
      { name: 'RestController', arguments: ['err'] },
      ...(params.useControllerFilters ? [{ name: 'UseErrorFilters', arguments: params.useControllerFilters }] : []),
    ],
    methods: [
      {
        name: 'boom',
        decorators: [
          { name: 'Get', arguments: ['boom'] },
          ...(params.useErrorFilters ? [{ name: 'UseErrorFilters', arguments: params.useErrorFilters }] : []),
        ],
        parameters: [],
      },
      {
        name: 'boomLiteral',
        decorators: [
          { name: 'Get', arguments: ['boom-literal'] },
          ...(params.useErrorFilters ? [{ name: 'UseErrorFilters', arguments: params.useErrorFilters }] : []),
        ],
        parameters: [],
      },
      {
        name: 'boomString',
        decorators: [
          { name: 'Get', arguments: ['boom-string'] },
          ...(params.useErrorFilters ? [{ name: 'UseErrorFilters', arguments: params.useErrorFilters }] : []),
        ],
        parameters: [],
      },
      {
        name: 'boomNumber',
        decorators: [
          { name: 'Get', arguments: ['boom-number'] },
          ...(params.useErrorFilters ? [{ name: 'UseErrorFilters', arguments: params.useErrorFilters }] : []),
        ],
        parameters: [],
      },
      {
        name: 'boomBoxedString',
        decorators: [
          { name: 'Get', arguments: ['boom-boxed-string'] },
          ...(params.useErrorFilters ? [{ name: 'UseErrorFilters', arguments: params.useErrorFilters }] : []),
        ],
        parameters: [],
      },
      {
        name: 'boomBoxedNumber',
        decorators: [
          { name: 'Get', arguments: ['boom-boxed-number'] },
          ...(params.useErrorFilters ? [{ name: 'UseErrorFilters', arguments: params.useErrorFilters }] : []),
        ],
        parameters: [],
      },
      {
        name: 'boomBoolean',
        decorators: [
          { name: 'Get', arguments: ['boom-boolean'] },
          ...(params.useErrorFilters ? [{ name: 'UseErrorFilters', arguments: params.useErrorFilters }] : []),
        ],
        parameters: [],
      },
      ...(params.includeOkRoute === true
        ? [
            {
              name: 'ok',
              decorators: [{ name: 'Get', arguments: ['ok'] }],
              parameters: [{ name: 'res', type: 'BunnerResponse', decorators: [{ name: 'Res', arguments: [] }] }],
            },
          ]
        : []),
    ],
  });

  return registry;
}

class AdapterController {
  [key: string]: RouteHandlerValue | RouteHandlerFunction;

  boom(..._args: readonly RouteHandlerArgument[]): RouteHandlerResult {
    throw new Error('boom');
  }
}

class AdapterGlobalErrorFilter extends BunnerErrorFilter {
  private onCall: (() => void) | undefined;

  setOnCall(onCall: () => void): void {
    this.onCall = onCall;
  }

  catch(_error: Parameters<BunnerErrorFilter['catch']>[0], ctx: Context): void {
    this.onCall?.();

    const http = assertHttpContext(ctx);

    http.response.setStatus(StatusCodes.IM_A_TEAPOT);
    http.response.setBody('adapter-filtered');
  }
}

function createAdapterRegistry(): Map<MetadataRegistryKey, ClassMetadata> {
  const registry = new Map<MetadataRegistryKey, ClassMetadata>();

  registry.set(AdapterController, {
    className: 'AdapterController',
    decorators: [{ name: 'Controller', arguments: ['adapter'] }],
    methods: [
      {
        name: 'boom',
        decorators: [{ name: 'Get', arguments: ['boom'] }],
        parameters: [],
      },
    ],
  });

  return registry;
}

describe('BunnerHttpAdapter.addErrorFilters', () => {
  it('should register global ErrorFilters via addErrorFilters', async () => {
    const onCall = mock(() => {});
    const metadataRegistry = createAdapterRegistry();

    registerRuntimeContext({ metadataRegistry });

    const container = new Container();
    const adapterFilter = new AdapterGlobalErrorFilter();

    adapterFilter.setOnCall(onCall);
    container.set(AdapterGlobalErrorFilter, () => adapterFilter);
    container.set(AdapterController, () => new AdapterController());

    const originalServe = Bun.serve;
    let serveCalls = 0;

    const serveMock: typeof Bun.serve = <WebSocketData = undefined, R extends string = never>(
      _options: Bun.Serve.Options<WebSocketData, R>,
    ): Bun.Server<WebSocketData> => {
      serveCalls += 1;

      const serverStub: Bun.Server<WebSocketData> = {
        stop: async () => {},
        reload: () => serverStub,
        fetch: () => new Response(),
        upgrade: () => false,
        publish: () => 0,
        subscriberCount: () => 0,
        requestIP: () => null,
        timeout: () => {},
        ref: () => {},
        unref: () => {},
        pendingRequests: 0,
        pendingWebSockets: 0,
        url: new URL('http://localhost'),
        port: 0,
        hostname: 'localhost',
        protocol: 'http',
        development: false,
        id: 'server-stub',
        [Symbol.dispose](): void {},
      };

      return serverStub;
    };

    Bun.serve = serveMock;

    try {
      const adapter = new BunnerHttpAdapter({ port: 0 });

      adapter.addErrorFilters([AdapterGlobalErrorFilter]);
      await adapter.start({ container });
    } finally {
      Bun.serve = originalServe;
    }

    const controllerRegistry = createControllerRegistry(metadataRegistry);
    const routeHandler = new RouteHandler(container, controllerRegistry, new Map());

    routeHandler.register();

    const requestHandler = new RequestHandler(container, routeHandler, metadataRegistry);
    const req = createRequest({ method: HttpMethod.Get, url: 'http://localhost/adapter/boom' });
    const res = createResponse(req);
    const workerResponse = await requestHandler.handle(req, res, HttpMethod.Get, '/adapter/boom');

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(serveCalls).toBe(1);
    expect(workerResponse.init.status).toBe(StatusCodes.IM_A_TEAPOT);
    expect(workerResponse.body).toBe('adapter-filtered');
  });
});

describe('RequestHandler.handle', () => {
  it('should throw during route registration when a UseErrorFilters token is not resolvable', () => {
    class MissingFilterToken extends BunnerErrorFilter {
      catch(): void {}
    }

    const metadataRegistry = createRegistry({ useErrorFilters: [MissingFilterToken] });

    expect(() => {
      createHttpTestHarness({
        metadataRegistry,
        providers: [...withGlobalMiddlewares({}), { token: ErrorController, value: new ErrorController() }],
      });
    }).toThrow();
  });

  it('should call ErrorFilter.catch with exactly (error, ctx)', async () => {
    const receivedArgs: Array<[SystemError, Context]> = [];

    class ArityCaptureFilter extends BunnerErrorFilter {
      catch(error: SystemError, ctx: Context): void {
        receivedArgs.push([error, ctx]);
      }
    }

    const metadataRegistry = createRegistry({ useErrorFilters: [], includeOkRoute: false });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ errorFilters: [new ArityCaptureFilter()] }),
        { token: ErrorController, value: new ErrorController() },
      ],
    });

    await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });
    expect(receivedArgs).toHaveLength(1);
    expect(receivedArgs[0]).toHaveLength(2);
    expect(receivedArgs[0]?.[0]).toBeInstanceOf(Error);
    expect(typeof receivedArgs[0]?.[1]?.to).toBe('function');
  });

  it('should combine @UseErrorFilters in method -> controller order', async () => {
    const calls: string[] = [];

    class MethodFilterToken extends BunnerErrorFilter {
      catch(): void {
        calls.push('method');
      }
    }

    class ControllerFilterToken extends BunnerErrorFilter {
      catch(): void {
        calls.push('controller');
      }
    }

    const metadataRegistry = createRegistry({
      useErrorFilters: [MethodFilterToken],
      useControllerFilters: [ControllerFilterToken],
      includeOkRoute: false,
    });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: MethodFilterToken, value: new MethodFilterToken() },
        { token: ControllerFilterToken, value: new ControllerFilterToken() },
        { token: ErrorController, value: new ErrorController() },
      ],
    });

    await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });
    expect(calls).toEqual(['method', 'controller']);
  });

  it('should run route-level ErrorFilters before global ErrorFilters', async () => {
    const calledRoute = mock(() => {});
    const calledGlobal = mock(() => {});

    class RouteFilterToken extends BunnerErrorFilter {
      catch(_e: Parameters<BunnerErrorFilter['catch']>[0], _ctx: Context): void {
        calledRoute();

        throw new Error('next');
      }
    }

    class GlobalFilterToken extends BunnerErrorFilter {
      catch(_e: Parameters<BunnerErrorFilter['catch']>[0], ctx: Context): void {
        calledGlobal();

        const http = assertHttpContext(ctx);

        http.response.setStatus(StatusCodes.BAD_GATEWAY);
        http.response.setBody('global');
      }
    }

    const metadataRegistry = createRegistry({ useErrorFilters: [RouteFilterToken] });

    metadataRegistry.set(RouteFilterToken, {
      className: 'RouteFilterToken',
      decorators: [{ name: 'Catch', arguments: [Error] }],
    });
    metadataRegistry.set(GlobalFilterToken, {
      className: 'GlobalFilterToken',
      decorators: [{ name: 'Catch', arguments: [Error] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ errorFilters: [new GlobalFilterToken()] }),
        { token: RouteFilterToken, value: new RouteFilterToken() },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });

    expect(calledRoute).toHaveBeenCalledTimes(1);
    expect(calledGlobal).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.BAD_GATEWAY);
    expect(workerResponse.body).toBe('global');
  });

  it('should dedupe duplicate ErrorFilter tokens between method and controller level', async () => {
    const onCall = mock(() => {});
    const setStatusFilter = new SetStatusFilter();

    setStatusFilter.setOnCall(onCall);

    const metadataRegistry = createRegistry({
      useErrorFilters: [SetStatusFilter],
      useControllerFilters: [SetStatusFilter],
    });

    metadataRegistry.set(SetStatusFilter, { className: 'SetStatusFilter', decorators: [{ name: 'Catch', arguments: [Error] }] });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: SetStatusFilter, value: setStatusFilter },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.IM_A_TEAPOT);
    expect(workerResponse.body).toBe('{"filtered":true}');
  });

  it('should catch primitive string errors when @Catch(String) is used', async () => {
    const onCall = mock(() => {});
    const catchStringFilter = new CatchStringFilter();

    catchStringFilter.setOnCall(onCall);

    const metadataRegistry = createRegistry({ useErrorFilters: [CatchStringFilter] });

    metadataRegistry.set(CatchStringFilter, {
      className: 'CatchStringFilter',
      decorators: [{ name: 'Catch', arguments: [String] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: CatchStringFilter, value: catchStringFilter },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom-string',
      url: 'http://localhost/err/boom-string',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.BAD_REQUEST);
    expect(workerResponse.body).toBe('caught-string');
  });

  it('should catch literal string errors when @Catch("LITERAL") is used', async () => {
    const onCall = mock(() => {});
    const catchLiteralFilter = new CatchLiteralFilter();

    catchLiteralFilter.setOnCall(onCall);

    const metadataRegistry = createRegistry({ useErrorFilters: [CatchLiteralFilter] });

    metadataRegistry.set(CatchLiteralFilter, {
      className: 'CatchLiteralFilter',
      decorators: [{ name: 'Catch', arguments: ['LITERAL'] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: CatchLiteralFilter, value: catchLiteralFilter },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom-literal',
      url: 'http://localhost/err/boom-literal',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.CONFLICT);
    expect(workerResponse.body).toBe('caught-literal');
  });

  it('should catch primitive number errors when @Catch(Number) is used', async () => {
    const onCall = mock(() => {});
    const catchNumberFilter = new CatchNumberFilter();

    catchNumberFilter.setOnCall(onCall);

    const metadataRegistry = createRegistry({ useErrorFilters: [CatchNumberFilter] });

    metadataRegistry.set(CatchNumberFilter, {
      className: 'CatchNumberFilter',
      decorators: [{ name: 'Catch', arguments: [Number] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: CatchNumberFilter, value: catchNumberFilter },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom-number',
      url: 'http://localhost/err/boom-number',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(workerResponse.body).toBe('caught-number');
  });

  it('should return 500 when no ErrorFilter matches', async () => {
    const metadataRegistry = createRegistry({ includeOkRoute: true });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: ErrorController, value: new ErrorController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should fall back to DefaultErrorHandler when ErrorFilter engine fails', async () => {
    const onCall = mock(() => {});
    const setStatusFilter = new SetStatusFilter();

    setStatusFilter.setOnCall(onCall);

    const metadataRegistry = createRegistry({ includeOkRoute: true });
    const invalidFilter: BunnerErrorFilter | null = null;
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ errorFilters: [invalidFilter, setStatusFilter] }),
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });

    expect(onCall).toHaveBeenCalledTimes(0);
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should continue to next ErrorFilter when current one throws', async () => {
    const metadataRegistry = createRegistry({ useErrorFilters: [RethrowFilter] });

    metadataRegistry.set(RethrowFilter, { className: 'RethrowFilter', decorators: [{ name: 'Catch', arguments: [Error] }] });

    class NextFilterToken extends BunnerErrorFilter {
      catch(_e: Parameters<BunnerErrorFilter['catch']>[0], ctx: Context): void {
        const http = assertHttpContext(ctx);

        http.response.setStatus(StatusCodes.SERVICE_UNAVAILABLE);
        http.response.setBody('next');
      }
    }

    metadataRegistry.set(NextFilterToken, { className: 'NextFilterToken', decorators: [{ name: 'Catch', arguments: [Error] }] });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ errorFilters: [new NextFilterToken()] }),
        { token: RethrowFilter, value: new RethrowFilter() },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(workerResponse.body).toBe('next');
  });

  it('should always run an ErrorFilter when it has no @Catch decorator', async () => {
    const onCall = mock(() => {});

    class NoCatchDecoratorFilter extends BunnerErrorFilter {
      catch(_e: Parameters<BunnerErrorFilter['catch']>[0], ctx: Context): void {
        onCall();

        const http = assertHttpContext(ctx);

        http.response.setStatus(StatusCodes.NOT_IMPLEMENTED);
        http.response.setBody('no-catch');
      }
    }

    const metadataRegistry = createRegistry({ useErrorFilters: [NoCatchDecoratorFilter] });
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: NoCatchDecoratorFilter, value: new NoCatchDecoratorFilter() },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.NOT_IMPLEMENTED);
    expect(workerResponse.body).toBe('no-catch');
  });

  it('should run an ErrorFilter when @Catch() has no arguments', async () => {
    const onCall = mock(() => {});

    class EmptyCatchArgsFilter extends BunnerErrorFilter {
      catch(_e: Parameters<BunnerErrorFilter['catch']>[0], ctx: Context): void {
        onCall();

        const http = assertHttpContext(ctx);

        http.response.setStatus(StatusCodes.GONE);
        http.response.setBody('empty-catch-args');
      }
    }

    const metadataRegistry = createRegistry({ useErrorFilters: [EmptyCatchArgsFilter] });

    metadataRegistry.set(EmptyCatchArgsFilter, {
      className: 'EmptyCatchArgsFilter',
      decorators: [{ name: 'Catch', arguments: [] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: EmptyCatchArgsFilter, value: new EmptyCatchArgsFilter() },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.GONE);
    expect(workerResponse.body).toBe('empty-catch-args');
  });

  it('should match when @Catch has multiple arguments and any matches', async () => {
    const onCall = mock(() => {});

    class MultiCatchFilter extends BunnerErrorFilter {
      catch(_e: Parameters<BunnerErrorFilter['catch']>[0], ctx: Context): void {
        onCall();

        const http = assertHttpContext(ctx);

        http.response.setStatus(StatusCodes.UNAUTHORIZED);
        http.response.setBody('multi');
      }
    }

    const metadataRegistry = createRegistry({ useErrorFilters: [MultiCatchFilter] });

    metadataRegistry.set(MultiCatchFilter, {
      className: 'MultiCatchFilter',
      decorators: [{ name: 'Catch', arguments: [Error, 'LITERAL', String] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: MultiCatchFilter, value: new MultiCatchFilter() },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom-literal',
      url: 'http://localhost/err/boom-literal',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(workerResponse.body).toBe('multi');
  });

  it('should catch boxed String errors when @Catch(String) is used', async () => {
    const onCall = mock(() => {});

    class BoxedStringFilter extends BunnerErrorFilter {
      catch(_e: Parameters<BunnerErrorFilter['catch']>[0], ctx: Context): void {
        onCall();

        const http = assertHttpContext(ctx);

        http.response.setStatus(StatusCodes.BAD_REQUEST);
        http.response.setBody('boxed-string');
      }
    }

    const metadataRegistry = createRegistry({ useErrorFilters: [BoxedStringFilter] });

    metadataRegistry.set(BoxedStringFilter, {
      className: 'BoxedStringFilter',
      decorators: [{ name: 'Catch', arguments: [String] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: BoxedStringFilter, value: new BoxedStringFilter() },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom-boxed-string',
      url: 'http://localhost/err/boom-boxed-string',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.BAD_REQUEST);
    expect(workerResponse.body).toBe('boxed-string');
  });

  it('should catch boxed Number errors when @Catch(Number) is used', async () => {
    const onCall = mock(() => {});

    class BoxedNumberFilter extends BunnerErrorFilter {
      catch(_e: Parameters<BunnerErrorFilter['catch']>[0], ctx: Context): void {
        onCall();

        const http = assertHttpContext(ctx);

        http.response.setStatus(StatusCodes.UNPROCESSABLE_ENTITY);
        http.response.setBody('boxed-number');
      }
    }

    const metadataRegistry = createRegistry({ useErrorFilters: [BoxedNumberFilter] });

    metadataRegistry.set(BoxedNumberFilter, {
      className: 'BoxedNumberFilter',
      decorators: [{ name: 'Catch', arguments: [Number] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: BoxedNumberFilter, value: new BoxedNumberFilter() },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom-boxed-number',
      url: 'http://localhost/err/boom-boxed-number',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(workerResponse.body).toBe('boxed-number');
  });

  it('should catch primitive boolean errors when @Catch(Boolean) is used', async () => {
    const onCall = mock(() => {});

    class BooleanFilter extends BunnerErrorFilter {
      catch(_e: Parameters<BunnerErrorFilter['catch']>[0], ctx: Context): void {
        onCall();

        const http = assertHttpContext(ctx);

        http.response.setStatus(StatusCodes.PRECONDITION_FAILED);
        http.response.setBody('boolean');
      }
    }

    const metadataRegistry = createRegistry({ useErrorFilters: [BooleanFilter] });

    metadataRegistry.set(BooleanFilter, { className: 'BooleanFilter', decorators: [{ name: 'Catch', arguments: [Boolean] }] });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: BooleanFilter, value: new BooleanFilter() },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom-boolean',
      url: 'http://localhost/err/boom-boolean',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.PRECONDITION_FAILED);
    expect(workerResponse.body).toBe('boolean');
  });

  it('should call SystemErrorHandler when ErrorFilters set body but leave status unset', async () => {
    const onFilter = mock(() => {});
    const onSystem = mock(() => {});

    class BodyOnlyFilter extends BunnerErrorFilter {
      catch(_e: Parameters<BunnerErrorFilter['catch']>[0], ctx: Context): void {
        onFilter();

        const http = assertHttpContext(ctx);

        http.response.setBody('body-only');
      }
    }

    const systemErrorHandler = {
      handle(_error: SystemError, ctx: Context): void {
        onSystem();

        const http = assertHttpContext(ctx);

        http.response.setStatus(StatusCodes.INTERNAL_SERVER_ERROR);
      },
    };
    const metadataRegistry = createRegistry({ useErrorFilters: [BodyOnlyFilter] });

    metadataRegistry.set(BodyOnlyFilter, { className: 'BodyOnlyFilter', decorators: [{ name: 'Catch', arguments: [Error] }] });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ systemErrorHandler }),
        { token: BodyOnlyFilter, value: new BodyOnlyFilter() },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onSystem).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('body-only');
  });

  it('should not call SystemErrorHandler when ErrorFilters already set a status', async () => {
    const onSystem = mock(() => {});
    const systemErrorHandler = {
      handle(): void {
        onSystem();
      },
    };
    const onCall = mock(() => {});
    const setStatusFilter = new SetStatusFilter();

    setStatusFilter.setOnCall(onCall);

    const metadataRegistry = createRegistry({
      useErrorFilters: [SetStatusFilter],
      useControllerFilters: [SetStatusFilter],
    });

    metadataRegistry.set(SetStatusFilter, { className: 'SetStatusFilter', decorators: [{ name: 'Catch', arguments: [Error] }] });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ systemErrorHandler }),
        { token: SetStatusFilter, value: setStatusFilter },
        { token: ErrorController, value: new ErrorController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/err/boom',
      url: 'http://localhost/err/boom',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onSystem).toHaveBeenCalledTimes(0);
    expect(workerResponse.init.status).toBe(StatusCodes.IM_A_TEAPOT);
    expect(workerResponse.body).toBe('{"filtered":true}');
  });
});
