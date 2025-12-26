import { BunnerErrorFilter } from '@bunner/common';
import { describe, expect, it, mock } from 'bun:test';
import { StatusCodes } from 'http-status-codes';

import { createHttpTestHarness, handleRequest, withGlobalMiddlewares } from '../http-test-kit';
import { BunnerHttpContext, type BunnerResponse, HttpMethod } from '../index';

class ErrorController {
  boom(): void {
    throw new Error('boom');
  }

  boomBoxedString(): void {
    throw Object('boxed');
  }

  boomBoxedNumber(): void {
    throw Object(123);
  }

  boomBoolean(): void {
    throw true;
  }

  boomLiteral(): void {
    throw 'LITERAL';
  }

  boomString(): void {
    throw 'boom';
  }

  boomNumber(): void {
    throw 123;
  }

  ok(res: BunnerResponse): unknown {
    res.setStatus(StatusCodes.OK);

    return { ok: true };
  }
}

class SetStatusFilter extends BunnerErrorFilter {
  constructor(private readonly onCall: () => void) {
    super();
  }

  catch(_error: any, context: any): void {
    this.onCall();

    const http = context.to(BunnerHttpContext);

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
  constructor(private readonly onCall: () => void) {
    super();
  }

  catch(_error: any, context: any): void {
    this.onCall();

    const http = context.to(BunnerHttpContext);

    http.response.setStatus(StatusCodes.BAD_REQUEST);
    http.response.setBody('caught-string');
  }
}

class CatchLiteralFilter extends BunnerErrorFilter {
  constructor(private readonly onCall: () => void) {
    super();
  }

  catch(_error: any, context: any): void {
    this.onCall();

    const http = context.to(BunnerHttpContext);

    http.response.setStatus(StatusCodes.CONFLICT);
    http.response.setBody('caught-literal');
  }
}

class CatchNumberFilter extends BunnerErrorFilter {
  constructor(private readonly onCall: () => void) {
    super();
  }

  catch(_error: any, context: any): void {
    this.onCall();

    const http = context.to(BunnerHttpContext);

    http.response.setStatus(StatusCodes.UNPROCESSABLE_ENTITY);
    http.response.setBody('caught-number');
  }
}

function createRegistry(params: {
  readonly useErrorFilters?: any[];
  readonly useControllerFilters?: any[];
  readonly includeOkRoute?: boolean;
}): Map<any, any> {
  const registry = new Map<any, any>();

  registry.set(ErrorController, {
    className: 'ErrorController',
    decorators: [
      { name: 'Controller', arguments: ['err'] },
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
      ...(params.includeOkRoute
        ? [
            {
              name: 'ok',
              decorators: [{ name: 'Get', arguments: ['ok'] }],
              parameters: [{ index: 0, name: 'res', type: 'BunnerResponse', decorators: [{ name: 'Res', arguments: [] }] }],
            },
          ]
        : []),
    ],
  });

  return registry;
}

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
  it('should run route-level ErrorFilters before global ErrorFilters', async () => {
    const calledRoute = mock(() => {});
    const calledGlobal = mock(() => {});

    class RouteFilterToken extends BunnerErrorFilter {
      catch(_e: any, _ctx: any): void {
        calledRoute();

        throw new Error('next');
      }
    }

    class GlobalFilterToken extends BunnerErrorFilter {
      catch(_e: any, ctx: any): void {
        calledGlobal();

        const http = ctx.to(BunnerHttpContext);

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
    const metadataRegistry = createRegistry({
      useErrorFilters: [SetStatusFilter],
      useControllerFilters: [SetStatusFilter],
    });

    metadataRegistry.set(SetStatusFilter, { className: 'SetStatusFilter', decorators: [{ name: 'Catch', arguments: [Error] }] });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: SetStatusFilter, value: new SetStatusFilter(onCall) },
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
    const metadataRegistry = createRegistry({ useErrorFilters: [CatchStringFilter] });

    metadataRegistry.set(CatchStringFilter, {
      className: 'CatchStringFilter',
      decorators: [{ name: 'Catch', arguments: [String] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: CatchStringFilter, value: new CatchStringFilter(onCall) },
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
    const metadataRegistry = createRegistry({ useErrorFilters: [CatchLiteralFilter] });

    metadataRegistry.set(CatchLiteralFilter, {
      className: 'CatchLiteralFilter',
      decorators: [{ name: 'Catch', arguments: ['LITERAL'] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: CatchLiteralFilter, value: new CatchLiteralFilter(onCall) },
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
    const metadataRegistry = createRegistry({ useErrorFilters: [CatchNumberFilter] });

    metadataRegistry.set(CatchNumberFilter, {
      className: 'CatchNumberFilter',
      decorators: [{ name: 'Catch', arguments: [Number] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({}),
        { token: CatchNumberFilter, value: new CatchNumberFilter(onCall) },
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
  it('should continue to next ErrorFilter when current one throws', async () => {
    const metadataRegistry = createRegistry({ useErrorFilters: [RethrowFilter] });

    metadataRegistry.set(RethrowFilter, { className: 'RethrowFilter', decorators: [{ name: 'Catch', arguments: [Error] }] });

    class NextFilterToken extends BunnerErrorFilter {
      catch(_e: any, ctx: any): void {
        const http = ctx.to(BunnerHttpContext);

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
      catch(_e: any, ctx: any): void {
        onCall();

        const http = ctx.to(BunnerHttpContext);

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
      catch(_e: any, ctx: any): void {
        onCall();

        const http = ctx.to(BunnerHttpContext);

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
      catch(_e: any, ctx: any): void {
        onCall();

        const http = ctx.to(BunnerHttpContext);

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
      catch(_e: any, ctx: any): void {
        onCall();

        const http = ctx.to(BunnerHttpContext);

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
      catch(_e: any, ctx: any): void {
        onCall();

        const http = ctx.to(BunnerHttpContext);

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
      catch(_e: any, ctx: any): void {
        onCall();

        const http = ctx.to(BunnerHttpContext);

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
      catch(_e: any, ctx: any): void {
        onFilter();

        const http = ctx.to(BunnerHttpContext);

        http.response.setBody('body-only');
      }
    }

    const systemErrorHandler = {
      handle(_error: unknown, ctx: any): void {
        onSystem();

        const http = ctx.to(BunnerHttpContext);

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
    const metadataRegistry = createRegistry({
      useErrorFilters: [SetStatusFilter],
      useControllerFilters: [SetStatusFilter],
    });

    metadataRegistry.set(SetStatusFilter, { className: 'SetStatusFilter', decorators: [{ name: 'Catch', arguments: [Error] }] });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ systemErrorHandler }),
        { token: SetStatusFilter, value: new SetStatusFilter(onCall) },
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
