import type { BunnerValue, Context } from '@bunner/common';

import { BunnerErrorFilter } from '@bunner/common';
import { describe, expect, it, mock } from 'bun:test';
import { StatusCodes } from 'http-status-codes';

import type { CombinedMetadataInput } from '../../../core/src/metadata/interfaces';
import type { ClassMetadata, HttpWorkerResponseBody, MetadataRegistryKey, SystemError } from '../../src/types';

import { createHttpTestHarness, handleRequest, withGlobalMiddlewares } from '../http-test-kit';
import { BunnerHttpContext, type BunnerResponse, HttpMethod } from '../index';

const isBunnerValue = (value: unknown): value is BunnerValue => {
  if (value === null || value === undefined) {
    return true;
  }

  const valueType = typeof value;

  if (
    valueType === 'string' ||
    valueType === 'number' ||
    valueType === 'boolean' ||
    valueType === 'bigint' ||
    valueType === 'symbol' ||
    valueType === 'function'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(entry => isBunnerValue(entry));
  }

  if (valueType === 'object') {
    return Object.values(value).every(entry => isBunnerValue(entry));
  }

  return false;
};

const isRecord = (value: BunnerValue | null): value is Record<string, BunnerValue> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isBunnerValueArray = (value: BunnerValue | undefined): value is BunnerValue[] => {
  return Array.isArray(value);
};

const assertRecord = (value: BunnerValue | null): asserts value is Record<string, BunnerValue> => {
  if (!isRecord(value)) {
    throw new Error('Expected record');
  }
};

const toBunnerRecord = (value: SystemError): Record<string, BunnerValue> | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record: Record<string, BunnerValue> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (isBunnerValue(entry)) {
      record[key] = entry;
    }
  }

  return record;
};

const parseWorkerBody = (body: HttpWorkerResponseBody): BunnerValue | null => {
  if (typeof body !== 'string') {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(body);

    return isBunnerValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

class CreateUserDto {
  name!: string;
  age!: number;
}

class ValidationController {
  create(res: BunnerResponse, body: CreateUserDto): Record<string, number | string> {
    res.setStatus(StatusCodes.OK);

    return { name: body.name, age: body.age };
  }
}

class HttpStatusErrorFilter extends BunnerErrorFilter<SystemError> {
  constructor(private readonly onCall: () => void) {
    super();
  }

  catch(error: SystemError, ctx: Context): void {
    this.onCall();

    const http = assertHttpContext(ctx);
    const errorRecord = toBunnerRecord(error);

    if (!errorRecord) {
      return;
    }

    const statusValue = errorRecord.status;

    if (typeof statusValue !== 'number') {
      return;
    }

    const messageValue = errorRecord.message;
    const detailsValue = errorRecord.details;
    const messageText =
      typeof messageValue === 'string'
        ? messageValue
        : typeof messageValue === 'number' || typeof messageValue === 'boolean'
          ? String(messageValue)
          : '';
    const detailsList = isBunnerValueArray(detailsValue) ? detailsValue : [];

    http.response.setStatus(statusValue);
    http.response.setBody({ message: messageText, details: detailsList });
  }
}

function assertHttpContext(ctx: Context): BunnerHttpContext {
  if (ctx instanceof BunnerHttpContext) {
    return ctx;
  }

  throw new Error('Expected BunnerHttpContext');
}

function createRegistry(): Map<MetadataRegistryKey, CombinedMetadataInput | ClassMetadata> {
  const registry = new Map<MetadataRegistryKey, CombinedMetadataInput | ClassMetadata>();

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
    decorators: [{ name: 'RestController', arguments: ['val'] }],
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
    // Arrange
    const metadataRegistry = createRegistry();
    const onErrorFilter = mock(() => undefined);

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
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Post,
      path: '/val/users',
      url: 'http://localhost/val/users',
      headers: { 'content-type': 'application/json' },
      body: { name: 'alice', age: '10' },
    });

    // Assert
    expect(onErrorFilter).toHaveBeenCalledTimes(0);
    expect(workerResponse.init.status).toBe(StatusCodes.OK);

    const parsed = parseWorkerBody(workerResponse.body);

    expect(isRecord(parsed)).toBeTrue();

    assertRecord(parsed);

    const record = parsed;

    expect(record).toEqual({ name: 'alice', age: 10 });
  });

  it('should return 400 when a required string field is missing', async () => {
    // Arrange
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
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Post,
      path: '/val/users',
      url: 'http://localhost/val/users',
      headers: { 'content-type': 'application/json' },
      body: { age: 10 },
    });

    // Assert
    expect(onErrorFilter).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.BAD_REQUEST);

    const parsed = parseWorkerBody(workerResponse.body);

    expect(isRecord(parsed)).toBeTrue();

    assertRecord(parsed);

    const record = parsed;
    const details = record.details;

    expect(record).toMatchObject({ message: 'Validation failed' });
    expect(isBunnerValueArray(details)).toBeTrue();

    const detailList = isBunnerValueArray(details) ? details : [];

    expect(detailList).toContain('name must be a string');
  });

  it('should return 400 when number conversion produces NaN', async () => {
    // Arrange
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
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Post,
      path: '/val/users',
      url: 'http://localhost/val/users',
      headers: { 'content-type': 'application/json' },
      body: { name: 'alice', age: 'nope' },
    });

    // Assert
    expect(onErrorFilter).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.BAD_REQUEST);

    const parsed = parseWorkerBody(workerResponse.body);

    expect(isRecord(parsed)).toBeTrue();

    assertRecord(parsed);

    const record = parsed;
    const details = record.details;

    expect(isBunnerValueArray(details)).toBeTrue();

    const detailList = isBunnerValueArray(details) ? details : [];

    expect(detailList).toContain('age must be an integer');
  });

  it('should return 400 when number is out of range', async () => {
    // Arrange
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
    // Act
    const { workerResponse } = await handleRequest({
      harness,
      method: HttpMethod.Post,
      path: '/val/users',
      url: 'http://localhost/val/users',
      headers: { 'content-type': 'application/json' },
      body: { name: 'alice', age: 151 },
    });

    // Assert
    expect(onErrorFilter).toHaveBeenCalledTimes(1);
    expect(workerResponse.init.status).toBe(StatusCodes.BAD_REQUEST);

    const parsed = parseWorkerBody(workerResponse.body);

    expect(isRecord(parsed)).toBeTrue();

    assertRecord(parsed);

    const record = parsed;
    const details = record.details;

    expect(isBunnerValueArray(details)).toBeTrue();

    const detailList = isBunnerValueArray(details) ? details : [];

    expect(detailList).toContain('age must be <= 150');
  });
});
