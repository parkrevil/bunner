import { BunnerErrorFilter } from '@bunner/common';
import { describe, expect, it, mock } from 'bun:test';
import { StatusCodes } from 'http-status-codes';

import { createHttpTestHarness, handleRequest, withGlobalMiddlewares } from '../http-test-kit';
import { BunnerHttpContext, type BunnerResponse, HttpMethod } from '../index';

class CreateUserDto {
  name!: string;
  age!: number;
}

class ValidationController {
  create(res: BunnerResponse, body: CreateUserDto): unknown {
    res.setStatus(StatusCodes.OK);

    return { name: body.name, age: body.age };
  }
}

class HttpStatusErrorFilter extends BunnerErrorFilter {
  constructor(private readonly onCall: () => void) {
    super();
  }

  catch(error: any, ctx: any): void {
    this.onCall();

    const http = ctx.to(BunnerHttpContext);

    if (typeof error?.status === 'number') {
      http.response.setStatus(error.status);
      http.response.setBody({ message: error.message, details: error.details });
    }
  }
}

function createRegistry(): Map<any, any> {
  const registry = new Map<any, any>();

  registry.set(CreateUserDto, {
    className: 'CreateUserDto',
    decorators: [],
    properties: [
      {
        name: 'name',
        decorators: [{ name: 'IsString', arguments: [], options: { message: 'name must be a string' } }],
        isOptional: false,
        isArray: false,
        type: String,
        isClass: false,
      },
      {
        name: 'age',
        decorators: [
          { name: 'IsInt', arguments: [], options: { message: 'age must be an integer' } },
          { name: 'Min', arguments: [0], options: { message: 'age must be >= 0' } },
          { name: 'Max', arguments: [150], options: { message: 'age must be <= 150' } },
        ],
        isOptional: false,
        isArray: false,
        type: Number,
        isClass: false,
      },
    ],
  });
  registry.set(ValidationController, {
    className: 'ValidationController',
    decorators: [{ name: 'Controller', arguments: ['val'] }],
    methods: [
      {
        name: 'create',
        decorators: [{ name: 'Post', arguments: ['users'] }],
        parameters: [
          { index: 0, name: 'res', type: 'BunnerResponse', decorators: [{ name: 'Res', arguments: [] }] },
          { index: 1, name: 'body', type: 'CreateUserDto', decorators: [{ name: 'Body', arguments: [] }] },
        ],
      },
    ],
  });

  return registry;
}

describe('RequestHandler.handle', () => {
  it('should validate and transform body when DTO metadata exists', async () => {
    const metadataRegistry = createRegistry();
    const onErrorFilter = mock(() => {});

    metadataRegistry.set(HttpStatusErrorFilter, {
      className: 'HttpStatusErrorFilter',
      decorators: [{ name: 'Catch', arguments: [Error] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ errorFilters: [new HttpStatusErrorFilter(onErrorFilter)] }),
        { token: ValidationController, value: new ValidationController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Post,
      path: '/val/users',
      url: 'http://localhost/val/users',
      headers: { 'content-type': 'application/json' },
      body: { name: 'alice', age: '10' },
    });

    expect(onErrorFilter).toHaveBeenCalledTimes(0);
    expect(workerResponse.init.status).toBe(StatusCodes.OK);

    const parsed = JSON.parse(String(workerResponse.body));

    expect(parsed).toEqual({ name: 'alice', age: 10 });
  });

  it('should return 400 when a required string field is missing', async () => {
    const metadataRegistry = createRegistry();
    const onErrorFilter = mock(() => {});

    metadataRegistry.set(HttpStatusErrorFilter, {
      className: 'HttpStatusErrorFilter',
      decorators: [{ name: 'Catch', arguments: [Error] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ errorFilters: [new HttpStatusErrorFilter(onErrorFilter)] }),
        { token: ValidationController, value: new ValidationController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Post,
      path: '/val/users',
      url: 'http://localhost/val/users',
      headers: { 'content-type': 'application/json' },
      body: { age: 10 },
    });

    expect(onErrorFilter).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.BAD_REQUEST);

    const parsed = JSON.parse(String(workerResponse.body));

    expect(parsed.message).toBe('Validation failed');
    expect(Array.isArray(parsed.details)).toBeTrue();
    expect(parsed.details).toContain('name must be a string');
  });

  it('should return 400 when number conversion produces NaN', async () => {
    const metadataRegistry = createRegistry();
    const onErrorFilter = mock(() => {});

    metadataRegistry.set(HttpStatusErrorFilter, {
      className: 'HttpStatusErrorFilter',
      decorators: [{ name: 'Catch', arguments: [Error] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ errorFilters: [new HttpStatusErrorFilter(onErrorFilter)] }),
        { token: ValidationController, value: new ValidationController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Post,
      path: '/val/users',
      url: 'http://localhost/val/users',
      headers: { 'content-type': 'application/json' },
      body: { name: 'alice', age: 'nope' },
    });

    expect(onErrorFilter).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.BAD_REQUEST);

    const parsed = JSON.parse(String(workerResponse.body));

    expect(parsed.details).toContain('age must be an integer');
  });

  it('should return 400 when number is out of range', async () => {
    const metadataRegistry = createRegistry();
    const onErrorFilter = mock(() => {});

    metadataRegistry.set(HttpStatusErrorFilter, {
      className: 'HttpStatusErrorFilter',
      decorators: [{ name: 'Catch', arguments: [Error] }],
    });

    const harness = createHttpTestHarness({
      metadataRegistry,
      providers: [
        ...withGlobalMiddlewares({ errorFilters: [new HttpStatusErrorFilter(onErrorFilter)] }),
        { token: ValidationController, value: new ValidationController() },
      ],
    });
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Post,
      path: '/val/users',
      url: 'http://localhost/val/users',
      headers: { 'content-type': 'application/json' },
      body: { name: 'alice', age: 151 },
    });

    expect(onErrorFilter).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.BAD_REQUEST);

    const parsed = JSON.parse(String(workerResponse.body));

    expect(parsed.details).toContain('age must be <= 150');
  });
});
