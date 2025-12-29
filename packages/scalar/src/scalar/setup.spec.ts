import type { AdapterCollection } from '@bunner/common';
import { describe, expect, it } from 'bun:test';

import type { ScalarSetupOptions } from './interfaces';
import { setupScalar } from './setup';

const BUNNER_HTTP_INTERNAL = Symbol.for('bunner:http:internal');

function createHttpAdapterSpy(): {
  adapter: Record<PropertyKey, unknown>;
  calls: Array<{ path: string; handler: (req?: unknown) => Response }>;
} {
  const calls: Array<{ path: string; handler: (req?: unknown) => Response }> = [];
  const adapter: Record<PropertyKey, unknown> = {
    [BUNNER_HTTP_INTERNAL]: {
      get: (path: string, handler: (req?: unknown) => Response) => {
        calls.push({ path, handler });
      },
    },
  };

  return { adapter, calls };
}

function getInternalRouteHandler(params: {
  calls: Array<{ path: string; handler: (req?: unknown) => Response }>;
  path: string;
}): (req?: unknown) => Response {
  const { calls, path } = params;
  const match = calls.find(call => call.path === path);

  if (!match) {
    throw new Error(`Expected route to be registered: ${path}`);
  }

  return match.handler;
}

describe('setupScalar', () => {
  // Removed global beforeEach/afterEach for AOT/Strict-Immutable compliance.
  // Instead, we inject a mock registry to each setupScalar call where needed.

  it('should throw when options are missing', () => {
    const adapters = { http: new Map() } as unknown as AdapterCollection;

    expect(() => setupScalar(adapters, undefined as unknown as ScalarSetupOptions)).toThrow(/documentTargets/i);
  });

  it('should throw when documentTargets is neither "all" nor an array', () => {
    const adapters = { http: new Map() } as unknown as AdapterCollection;

    expect(() =>
      setupScalar(adapters, {
        documentTargets: 'invalid',
        httpTargets: [],
        metadataRegistry: new Map(),
      } as unknown as ScalarSetupOptions),
    ).toThrow(/documentTargets must be/i);
  });

  it('should throw when httpTargets is undefined', () => {
    const adapters = { http: new Map() } as unknown as AdapterCollection;

    expect(() =>
      setupScalar(adapters, {
        documentTargets: 'all',
        httpTargets: undefined,
        metadataRegistry: new Map(),
      } as unknown as ScalarSetupOptions),
    ).toThrow(/httpTargets must be/i);
  });

  it('should throw when httpTargets is neither "all" nor an array', () => {
    const adapters = { http: new Map() } as unknown as AdapterCollection;

    expect(() =>
      setupScalar(adapters, {
        documentTargets: 'all',
        httpTargets: 'invalid',
        metadataRegistry: new Map(),
      } as unknown as ScalarSetupOptions),
    ).toThrow(/httpTargets must be/i);
  });

  it('should throw when no HTTP adapter is selected for hosting', () => {
    const adapters = { http: new Map() } as unknown as AdapterCollection;

    expect(() =>
      setupScalar(adapters, {
        documentTargets: 'all',
        httpTargets: [],
        metadataRegistry: new Map(),
      }),
    ).toThrow(/no HTTP adapter selected/i);
  });

  it('should throw when the http adapter group does not support lookup', () => {
    const httpGroup = {
      forEach(callback: (adapter: unknown, name: unknown) => void): void {
        callback({}, 'http-server');
      },
    };
    const adapters = { http: httpGroup } as unknown as AdapterCollection;

    expect(() =>
      setupScalar(adapters, {
        documentTargets: 'all',
        httpTargets: ['http-server'],
        metadataRegistry: new Map(),
      }),
    ).toThrow(/does not support lookup/i);
  });

  it('should throw when selected httpTargets do not exist', () => {
    const { adapter } = createHttpAdapterSpy();
    const http = new Map<string, unknown>([['http-server', adapter]]);
    const adapters = { http } as unknown as AdapterCollection;

    expect(() =>
      setupScalar(adapters, {
        documentTargets: 'all',
        httpTargets: ['missing'],
        metadataRegistry: new Map(),
      }),
    ).toThrow(/httpTargets not found/i);
  });

  it('should register exactly the two internal routes when an adapter supports internal binding', () => {
    const { adapter, calls } = createHttpAdapterSpy();
    const http = new Map<string, unknown>([['http-server', adapter]]);
    const adapters = { http } as unknown as AdapterCollection;

    setupScalar(adapters, {
      documentTargets: 'all',
      httpTargets: ['http-server'],
      metadataRegistry: new Map(),
    });
    expect(calls).toHaveLength(2);
    expect(calls.map(call => call.path)).toEqual(['/api-docs', '/api-docs/*']);
  });

  it('should not register routes twice for the same adapter', () => {
    const { adapter, calls } = createHttpAdapterSpy();
    const http = new Map<string, unknown>([['http-server', adapter]]);
    const adapters = { http } as unknown as AdapterCollection;

    setupScalar(adapters, { documentTargets: 'all', httpTargets: ['http-server'], metadataRegistry: new Map() });
    setupScalar(adapters, { documentTargets: 'all', httpTargets: ['http-server'], metadataRegistry: new Map() });
    expect(calls).toHaveLength(2);
  });

  it('should serve Scalar UI at /api-docs when exactly one document exists', async () => {
    const { adapter, calls } = createHttpAdapterSpy();
    const http = new Map<string, unknown>([['http-server', adapter]]);
    const adapters = { http } as unknown as AdapterCollection;

    setupScalar(adapters, {
      documentTargets: 'all',
      httpTargets: ['http-server'],
      metadataRegistry: new Map(),
    });

    const handler = getInternalRouteHandler({ calls, path: '/api-docs' });
    const response = handler();
    const text = await response.text();

    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(text).toContain('api-reference');
  });

  it('should serve an index at /api-docs when multiple documents exist', async () => {
    const adapterSpyA = createHttpAdapterSpy();
    const adapterSpyB = createHttpAdapterSpy();
    const http = new Map<string, unknown>([
      ['http-a', adapterSpyA.adapter],
      ['http-b', adapterSpyB.adapter],
    ]);
    const adapters = { http } as unknown as AdapterCollection;

    setupScalar(adapters, {
      documentTargets: 'all',
      httpTargets: ['http-a'],
      metadataRegistry: new Map(),
    });

    const handler = getInternalRouteHandler({ calls: adapterSpyA.calls, path: '/api-docs' });
    const response = handler();
    const text = await response.text();

    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(text).toContain('<ul>');
    expect(text).toContain('openapi:http:http-a');
    expect(text).toContain('openapi:http:http-b');
    expect(text).not.toContain('api-reference');
  });

  it('should serve JSON from /api-docs/* when a .json document path is requested', async () => {
    const { adapter, calls } = createHttpAdapterSpy();
    const http = new Map<string, unknown>([['http-server', adapter]]);
    const adapters = { http } as unknown as AdapterCollection;

    setupScalar(adapters, {
      documentTargets: 'all',
      httpTargets: ['http-server'],
      metadataRegistry: new Map(),
    });

    const handler = getInternalRouteHandler({ calls, path: '/api-docs/*' });
    const response = handler({ path: '/api-docs/openapi:http:http-server.json' });
    const parsed = JSON.parse(await response.text());

    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(parsed).toHaveProperty('openapi', '3.0.0');
  });

  it('should serve UI from /api-docs/* when a non-.json document path is requested', async () => {
    const { adapter, calls } = createHttpAdapterSpy();
    const http = new Map<string, unknown>([['http-server', adapter]]);
    const adapters = { http } as unknown as AdapterCollection;

    setupScalar(adapters, {
      documentTargets: 'all',
      httpTargets: ['http-server'],
      metadataRegistry: new Map(),
    });

    const handler = getInternalRouteHandler({ calls, path: '/api-docs/*' });
    const response = handler({ path: '/api-docs/openapi:http:http-server' });
    const text = await response.text();

    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(text).toContain('api-reference');
  });

  it('should return 404 from /api-docs/* when the request path is missing', () => {
    const { adapter, calls } = createHttpAdapterSpy();
    const http = new Map<string, unknown>([['http-server', adapter]]);
    const adapters = { http } as unknown as AdapterCollection;

    setupScalar(adapters, {
      documentTargets: 'all',
      httpTargets: ['http-server'],
      metadataRegistry: new Map(),
    });

    const handler = getInternalRouteHandler({ calls, path: '/api-docs/*' });
    const response = handler({});

    expect(response.status).toBe(404);
  });

  it('should return 404 from /api-docs/* when the document does not exist', () => {
    const { adapter, calls } = createHttpAdapterSpy();
    const http = new Map<string, unknown>([['http-server', adapter]]);
    const adapters = { http } as unknown as AdapterCollection;

    setupScalar(adapters, {
      documentTargets: 'all',
      httpTargets: ['http-server'],
      metadataRegistry: new Map(),
    });

    const handler = getInternalRouteHandler({ calls, path: '/api-docs/*' });
    const response = handler({ path: '/api-docs/nope.json' });

    expect(response.status).toBe(404);
  });
});
