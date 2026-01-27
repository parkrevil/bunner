import { describe, expect, it } from 'bun:test';

import type { OpenApiDocument, OpenApiOperation, OpenApiPathItem, OpenApiRecord } from './openapi';
import type { ScalarMetadataRegistry, ScalarNode, ScalarRecord, ScalarRegistryKey } from './scalar/types';

import { OpenApiFactory } from './spec-factory';

function createRegistryForUsersController(): ScalarMetadataRegistry {
  const controllerMeta: ScalarRecord = {
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
          { name: 'ApiCreatedResponse', arguments: [{ description: 'Created', type: 'CreateUserDto' }] },
        ],
        parameters: [{ name: 'body', type: 'CreateUserDto', decorators: [{ name: 'Body', arguments: [] }] }],
      },
    ],
  };
  const dtoMeta: ScalarRecord = {
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

  return new Map<ScalarRegistryKey, ScalarRecord>([
    ['UsersController', controllerMeta],
    ['CreateUserDto', dtoMeta],
  ]);
}

function createRegistryForNestedSchemaShapes(): ScalarMetadataRegistry {
  const childMeta: ScalarRecord = {
    className: 'ChildDto',
    decorators: [],
    methods: [],
    properties: [{ name: 'age', type: 'number', decorators: [] }],
  };
  const parentMeta: ScalarRecord = {
    className: 'ParentDto',
    decorators: [],
    methods: [],
    properties: [
      { name: 'child', type: 'ChildDto', isClass: true, decorators: [] },
      { name: 'children', isArray: true, items: { typeName: 'ChildDto' }, decorators: [] },
    ],
  };
  const controllerMeta: ScalarRecord = {
    className: 'TestController',
    decorators: [{ name: 'Controller', arguments: ['/t'] }],
    methods: [
      {
        name: 'create',
        decorators: [{ name: 'Post', arguments: ['/'] }],
        parameters: [{ name: 'body', type: 'ParentDto', decorators: [{ name: 'Body', arguments: [] }] }],
      },
    ],
  };

  return new Map<ScalarRegistryKey, ScalarRecord>([
    ['TestController', controllerMeta],
    ['ChildDto', childMeta],
    ['ParentDto', parentMeta],
  ]);
}

function getPathItemOrThrow(paths: Record<string, OpenApiPathItem>, path: string): OpenApiPathItem {
  const entry = Object.entries(paths).find(([key]) => key === path);

  if (!entry) {
    throw new Error(`Expected ${path} path to exist`);
  }

  return entry[1];
}

function getSchemaOrThrow(doc: OpenApiDocument, name: string): OpenApiRecord {
  const entry = Object.entries(doc.components.schemas).find(([key]) => key === name);

  if (!entry) {
    throw new Error(`Expected ${name} schema to exist`);
  }

  return entry[1];
}

function getRecordEntryOrThrow(record: OpenApiRecord, key: string): OpenApiRecord {
  const entry = Object.entries(record).find(([entryKey]) => entryKey === key);

  if (!entry) {
    throw new Error(`Expected record entry to exist: ${key}`);
  }

  const value = entry[1];

  if (!isOpenApiRecord(value)) {
    throw new Error(`Expected record entry to be a record: ${key}`);
  }

  return value;
}

function getOperationRecordOrThrow(pathItem: OpenApiPathItem, method: 'get' | 'post'): OpenApiRecord {
  const value = method === 'get' ? pathItem.get : pathItem.post;

  if (!isOpenApiRecord(value)) {
    throw new Error(`Expected ${method} operation to be a record`);
  }

  return value;
}

function isOpenApiRecord(value: OpenApiOperation | OpenApiRecord | ScalarNode | undefined): value is OpenApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('spec-factory', () => {
  describe('OpenApiFactory.create', () => {
    it('should return a minimal OpenAPI document when the registry is empty', () => {
      // Arrange
      const registry = new Map<ScalarRegistryKey, ScalarRecord>();
      // Act
      const doc = OpenApiFactory.create(registry, { title: 'T', version: 'V' });

      // Assert
      expect(doc.openapi).toBe('3.0.0');
      expect(doc.info).toEqual({ title: 'T', version: 'V' });
      expect(doc.paths).toEqual({});
      expect(doc.components).toEqual({ schemas: {} });
    });

    it('should normalize route paths when controller metadata is present', () => {
      // Arrange
      const registry = createRegistryForUsersController();
      // Act
      const doc = OpenApiFactory.create(registry, { title: 'API Docs', version: '1.0.0' });
      const usersPath = getPathItemOrThrow(doc.paths, '/users/{id}');
      const basePath = getPathItemOrThrow(doc.paths, '/users');

      // Assert
      expect(usersPath).toBeDefined();
      expect(basePath).toBeDefined();
    });

    it('should apply ApiOperation metadata when the decorator is present', () => {
      // Arrange
      const registry = createRegistryForUsersController();
      const doc = OpenApiFactory.create(registry, { title: 'API Docs', version: '1.0.0' });
      // Act
      const pathItem = getPathItemOrThrow(doc.paths, '/users/{id}');
      const operationValue = getOperationRecordOrThrow(pathItem, 'get');

      // Assert
      expect(operationValue.summary).toBe('Get one');
      expect(operationValue.description).toBe('Get by id');
    });

    it('should generate parameters when Param and Query decorators are present', () => {
      // Arrange
      const registry = createRegistryForUsersController();
      const doc = OpenApiFactory.create(registry, { title: 'API Docs', version: '1.0.0' });
      // Act
      const pathItem = getPathItemOrThrow(doc.paths, '/users/{id}');
      const operationValue = getOperationRecordOrThrow(pathItem, 'get');

      // Assert
      expect(operationValue.parameters).toEqual([
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'verbose', in: 'query', required: false, schema: { type: 'string' } },
      ]);
    });

    it('should generate requestBody schema when Body parameters are present', () => {
      // Arrange
      const registry = createRegistryForUsersController();
      const doc = OpenApiFactory.create(registry, { title: 'API Docs', version: '1.0.0' });
      // Act
      const pathItem = getPathItemOrThrow(doc.paths, '/users');
      const operationValue = getOperationRecordOrThrow(pathItem, 'post');
      const requestBodyValue = getRecordEntryOrThrow(operationValue, 'requestBody');
      const contentValue = getRecordEntryOrThrow(requestBodyValue, 'content');
      const jsonContentValue = getRecordEntryOrThrow(contentValue, 'application/json');

      // Assert
      expect(jsonContentValue.schema).toEqual({ $ref: '#/components/schemas/CreateUserDto' });
    });

    it('should create a component schema when ApiProperty metadata is present', () => {
      // Arrange
      const registry = createRegistryForUsersController();
      const doc = OpenApiFactory.create(registry, { title: 'API Docs', version: '1.0.0' });
      // Act
      const schemaValue = getSchemaOrThrow(doc, 'CreateUserDto');
      const propsValue = getRecordEntryOrThrow(schemaValue, 'properties');

      // Assert
      expect(propsValue.email).toEqual({
        type: 'string',
        description: 'email',
        example: 'a@b.com',
      });
    });

    it('should create component schemas when nested objects and arrays are present', () => {
      // Arrange
      const registry = createRegistryForNestedSchemaShapes();
      const doc = OpenApiFactory.create(registry, { title: 'T', version: 'V' });
      // Act
      const parentSchemaValue = getSchemaOrThrow(doc, 'ParentDto');
      const childSchemaValue = getSchemaOrThrow(doc, 'ChildDto');
      const parentProps = getRecordEntryOrThrow(parentSchemaValue, 'properties');

      // Assert
      expect(childSchemaValue).toBeDefined();
      expect(parentProps.child).toEqual({ $ref: '#/components/schemas/ChildDto' });
      expect(parentProps.children).toEqual({
        type: 'array',
        items: { $ref: '#/components/schemas/ChildDto' },
      });
    });
  });
});
