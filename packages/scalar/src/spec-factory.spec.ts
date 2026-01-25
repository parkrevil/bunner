import { describe, expect, it } from 'bun:test';

import { isRecord } from './common/guards';
import { OpenApiFactory } from './spec-factory';

type DecoratorMeta = { name: string; arguments: unknown[] };

type RegistryMeta = {
  className: string;
  decorators: DecoratorMeta[];
  methods: Array<{
    name: string;
    decorators: DecoratorMeta[];
    parameters: Array<{
      name: string;
      type?: unknown;
      decorators: DecoratorMeta[];
    }>;
  }>;
  properties?: Array<{
    name: string;
    type?: unknown;
    isClass?: boolean;
    isArray?: boolean;
    items?: { typeName?: unknown };
    decorators?: DecoratorMeta[];
  }>;
};

function createRegistryForUsersController(): Map<unknown, unknown> {
  class CreateUserDto {}

  const controllerMeta: RegistryMeta = {
    className: 'UsersController',
    decorators: [
      { name: 'Controller', arguments: ['/users'] },
      { name: 'ApiTags', arguments: ['Users'] },
    ],
    methods: [
      {
        name: 'getById',
        decorators: [
          { name: 'Get', arguments: ['/:id'] },
          { name: 'ApiOperation', arguments: [{ summary: 'Get one', description: 'Get by id' }] },
          { name: 'ApiOkResponse', arguments: [{ description: 'OK' }] },
        ],
        parameters: [
          { name: 'id', decorators: [{ name: 'Param', arguments: ['id'] }] },
          { name: 'verbose', decorators: [{ name: 'Query', arguments: ['verbose'] }] },
        ],
      },
      {
        name: 'create',
        decorators: [
          { name: 'Post', arguments: ['/'] },
          { name: 'ApiCreatedResponse', arguments: [{ description: 'Created', type: CreateUserDto }] },
        ],
        parameters: [{ name: 'body', type: CreateUserDto, decorators: [{ name: 'Body', arguments: [] }] }],
      },
    ],
  };
  const dtoMeta: RegistryMeta = {
    className: 'CreateUserDto',
    decorators: [],
    methods: [],
    properties: [
      {
        name: 'email',
        type: 'string',
        decorators: [{ name: 'ApiProperty', arguments: [{ description: 'email', example: 'a@b.com' }] }],
      },
    ],
  };

  return new Map<unknown, unknown>([
    [class UsersController {}, controllerMeta],
    [CreateUserDto, dtoMeta],
  ]);
}

function createRegistryForNestedSchemaShapes(): Map<unknown, unknown> {
  class ChildDto {}

  class ParentDto {}

  const childMeta: RegistryMeta = {
    className: 'ChildDto',
    decorators: [],
    methods: [],
    properties: [{ name: 'age', type: 'number', decorators: [] }],
  };
  const parentMeta: RegistryMeta = {
    className: 'ParentDto',
    decorators: [],
    methods: [],
    properties: [
      { name: 'child', type: ChildDto, isClass: true, decorators: [] },
      { name: 'children', isArray: true, items: { typeName: ChildDto }, decorators: [] },
    ],
  };
  const controllerMeta: RegistryMeta = {
    className: 'TestController',
    decorators: [{ name: 'Controller', arguments: ['/t'] }],
    methods: [
      {
        name: 'create',
        decorators: [{ name: 'Post', arguments: ['/'] }],
        parameters: [{ name: 'body', type: ParentDto, decorators: [{ name: 'Body', arguments: [] }] }],
      },
    ],
  };

  return new Map<unknown, unknown>([
    [class TestController {}, controllerMeta],
    [ChildDto, childMeta],
    [ParentDto, parentMeta],
  ]);
}

describe('OpenApiFactory.create', () => {
  it('should return a minimal OpenAPI document when the registry is empty', () => {
    const registry = new Map<unknown, unknown>();
    const doc = OpenApiFactory.create(registry, { title: 'T', version: 'V' });

    expect(doc.openapi).toBe('3.0.0');
    expect(doc.info).toEqual({ title: 'T', version: 'V' });
    expect(doc.paths).toEqual({});
    expect(doc.components).toEqual({ schemas: {} });
  });

  it('should normalize route paths and convert params to {param}', () => {
    const registry = createRegistryForUsersController();
    const doc = OpenApiFactory.create(registry, { title: 'API Docs', version: '1.0.0' });

    expect(doc.paths['/users/{id}']).toBeDefined();
    expect(doc.paths['/users']).toBeDefined();
  });

  it('should apply ApiOperation metadata to the generated operation', () => {
    const registry = createRegistryForUsersController();
    const doc = OpenApiFactory.create(registry, { title: 'API Docs', version: '1.0.0' });
    const pathItem = doc.paths['/users/{id}'];

    if (!pathItem) {
      throw new Error('Expected /users/{id} path to exist');
    }

    const operationValue = pathItem.get;

    if (!isRecord(operationValue)) {
      throw new Error('Expected get operation to be a record');
    }

    expect(operationValue.summary).toBe('Get one');
    expect(operationValue.description).toBe('Get by id');
  });

  it('should generate path and query parameters from Param and Query decorators', () => {
    const registry = createRegistryForUsersController();
    const doc = OpenApiFactory.create(registry, { title: 'API Docs', version: '1.0.0' });
    const pathItem = doc.paths['/users/{id}'];

    if (!pathItem) {
      throw new Error('Expected /users/{id} path to exist');
    }

    const operationValue = pathItem.get;

    if (!isRecord(operationValue)) {
      throw new Error('Expected get operation to be a record');
    }

    expect(operationValue.parameters).toEqual([
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      { name: 'verbose', in: 'query', required: false, schema: { type: 'string' } },
    ]);
  });

  it('should generate requestBody schema when a Body parameter exists', () => {
    const registry = createRegistryForUsersController();
    const doc = OpenApiFactory.create(registry, { title: 'API Docs', version: '1.0.0' });
    const pathItem = doc.paths['/users'];

    if (!pathItem) {
      throw new Error('Expected /users path to exist');
    }

    const operationValue = pathItem.post;

    if (!isRecord(operationValue)) {
      throw new Error('Expected post operation to be a record');
    }

    const requestBodyValue = operationValue.requestBody;

    if (!isRecord(requestBodyValue)) {
      throw new Error('Expected requestBody to be a record');
    }

    const contentValue = requestBodyValue.content;

    if (!isRecord(contentValue)) {
      throw new Error('Expected requestBody.content to be a record');
    }

    const jsonContentValue = contentValue['application/json'];

    if (!isRecord(jsonContentValue)) {
      throw new Error('Expected requestBody.content[application/json] to be a record');
    }

    expect(jsonContentValue.schema).toEqual({ $ref: '#/components/schemas/CreateUserDto' });
  });

  it('should create a component schema for ApiProperty metadata', () => {
    const registry = createRegistryForUsersController();
    const doc = OpenApiFactory.create(registry, { title: 'API Docs', version: '1.0.0' });
    const schemaValue = doc.components.schemas['CreateUserDto'];

    if (!isRecord(schemaValue)) {
      throw new Error('Expected CreateUserDto schema to be a record');
    }

    const propsValue = schemaValue.properties;

    if (!isRecord(propsValue)) {
      throw new Error('Expected CreateUserDto properties to be a record');
    }

    expect(propsValue.email).toEqual({
      type: 'string',
      description: 'email',
      example: 'a@b.com',
    });
  });

  it('should create component schemas for nested objects and arrays', () => {
    const registry = createRegistryForNestedSchemaShapes();
    const doc = OpenApiFactory.create(registry, { title: 'T', version: 'V' });
    const parentSchemaValue = doc.components.schemas['ParentDto'];
    const childSchemaValue = doc.components.schemas['ChildDto'];

    if (!isRecord(parentSchemaValue) || !isRecord(childSchemaValue)) {
      throw new Error('Expected ParentDto and ChildDto schemas to exist');
    }

    const parentProps = parentSchemaValue.properties;

    if (!isRecord(parentProps)) {
      throw new Error('Expected ParentDto properties to be a record');
    }

    expect(parentProps.child).toEqual({ $ref: '#/components/schemas/ChildDto' });
    expect(parentProps.children).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/ChildDto' },
    });
  });
});
