import { describe, expect, it } from 'bun:test';
import { StatusCodes } from 'http-status-codes';

import { createHttpTestHarness, handleRequest, withGlobalMiddlewares } from '../http-test-kit';
import type { BunnerResponse } from '../index';
import { HttpMethod } from '../index';

class RoutingController {
  ok(res: BunnerResponse): unknown {
    res.setStatus(StatusCodes.OK);

    return { ok: true };
  }

  echoParams(params: Record<string, string> | undefined, res: BunnerResponse): unknown {
    res.setStatus(StatusCodes.OK);

    return { id: params?.id };
  }
}

type RoutingControllerMeta = {
  readonly className: string;
  readonly decorators: ReadonlyArray<any>;
  readonly methods: ReadonlyArray<any>;
};

function createRoutingRegistry(): Map<any, any> {
  const registry = new Map<any, any>();
  const controllerMeta: RoutingControllerMeta = {
    className: 'RoutingController',
    decorators: [{ name: 'Controller', arguments: ['test'] }],
    methods: [
      {
        name: 'ok',
        decorators: [{ name: 'Get', arguments: ['ok'] }],
        parameters: [{ index: 0, name: 'res', type: 'BunnerResponse', decorators: [{ name: 'Res', arguments: [] }] }],
      },
      {
        name: 'echoParams',
        decorators: [{ name: 'Get', arguments: ['items/:id'] }],
        parameters: [
          { index: 0, name: 'params', type: 'Record', decorators: [{ name: 'Param', arguments: [] }] },
          { index: 1, name: 'res', type: 'BunnerResponse', decorators: [{ name: 'Res', arguments: [] }] },
        ],
      },
    ],
  };

  registry.set(RoutingController, controllerMeta);

  return registry;
}

describe('RequestHandler.handle', () => {
  it('should route to a controller method', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/ok',
      url: 'http://localhost/test/ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });

  it('should match when trailing slash is present', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/ok/',
      url: 'http://localhost/test/ok/',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });

  it('should return 500 when route is not found', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/missing',
      url: 'http://localhost/test/missing',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should return 500 when method is not registered', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Post,
      path: '/test/ok',
      url: 'http://localhost/test/ok',
      headers: { 'content-type': 'application/json' },
      body: {},
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should return 500 when path traversal is present', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/../ok',
      url: 'http://localhost/test/../ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should match even when query string is included in path input', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/ok?x=1&y=2',
      url: 'http://localhost/test/ok?x=1&y=2',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });

  it('should match when multiple slashes are present in the path', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test//ok',
      url: 'http://localhost/test//ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });

  it('should return 500 when collapseSlashes is false and path contains internal double slashes', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      routerOptions: { collapseSlashes: false, ignoreTrailingSlash: true },
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test//ok',
      url: 'http://localhost/test//ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should match when path does not start with a leading slash', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: 'test/ok',
      url: 'http://localhost/test/ok',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });

  it('should return 500 when case does not match and router is case-sensitive', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/TEST/OK',
      url: 'http://localhost/TEST/OK',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should match when case does not match and router is case-insensitive', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      routerOptions: { caseSensitive: false },
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/TEST/OK',
      url: 'http://localhost/TEST/OK',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"ok":true}');
  });

  it('should return 500 for an empty path', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '',
      url: 'http://localhost/',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should return 500 when a path segment exceeds the max segment length', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const longSegment = 'a'.repeat(257);
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: `/test/${longSegment}`,
      url: `http://localhost/test/${longSegment}`,
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should match when maxSegmentLength is increased to allow long param segments', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      routerOptions: { maxSegmentLength: 512 },
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const longSegment = 'a'.repeat(257);
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: `/test/items/${longSegment}`,
      url: `http://localhost/test/items/${longSegment}`,
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe(`{"id":"${longSegment}"}`);
  });

  it('should not throw on malformed percent encoding when failFastOnBadEncoding is false', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/%E0%A4%A',
      url: 'http://localhost/test/%E0%A4%A',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should match and keep raw param when percent decoding fails and failFastOnBadEncoding is false', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      routerOptions: { failFastOnBadEncoding: false },
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/items/%E0%A4%A',
      url: 'http://localhost/test/items/%E0%A4%A',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"id":"%E0%A4%A"}');
  });

  it('should return 500 when percent decoding fails and failFastOnBadEncoding is true', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      routerOptions: { failFastOnBadEncoding: true },
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/items/%E0%A4%A',
      url: 'http://localhost/test/items/%E0%A4%A',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should decode %2F in params when encodedSlashBehavior is decode', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      routerOptions: { encodedSlashBehavior: 'decode' },
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/items/a%2Fb',
      url: 'http://localhost/test/items/a%2Fb',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"id":"a/b"}');
  });

  it('should preserve %2F in params when encodedSlashBehavior is preserve', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      routerOptions: { encodedSlashBehavior: 'preserve' },
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/items/a%2Fb',
      url: 'http://localhost/test/items/a%2Fb',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"id":"a%2Fb"}');
  });

  it('should return 500 when encodedSlashBehavior is reject and params contain %2F', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      routerOptions: { encodedSlashBehavior: 'reject' },
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/items/a%2Fb',
      url: 'http://localhost/test/items/a%2Fb',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });

  it('should not decode params when decodeParams is false even if encodedSlashBehavior is reject', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      routerOptions: { decodeParams: false, encodedSlashBehavior: 'reject' },
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/test/items/a%2Fb',
      url: 'http://localhost/test/items/a%2Fb',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.OK);
    expect(workerResponse.body).toBe('{"id":"a%2Fb"}');
  });

  it('should return 500 for unicode paths that do not match a registered route', async () => {
    const metadataRegistry = createRoutingRegistry();
    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [...withGlobalMiddlewares({}), { token: RoutingController, value: new RoutingController() }],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Get,
      path: '/테스트/오케이',
      url: 'http://localhost/%ED%85%8C%EC%8A%A4%ED%8A%B8/%EC%98%A4%EC%BC%80%EC%9D%B4',
    });

    expect(workerResponse.init.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(workerResponse.body).toBe('Internal Server Error');
  });
});
