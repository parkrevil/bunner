import { describe, expect, it } from 'bun:test';

import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from './index';

class TestDecoratorTarget {
  method(_arg?: unknown): void {}
}

function getMethodDescriptor(): TypedPropertyDescriptor<unknown> {
  const descriptor = Object.getOwnPropertyDescriptor(TestDecoratorTarget.prototype, 'method');

  if (!descriptor) {
    throw new Error('Expected method descriptor to exist');
  }

  return descriptor as unknown as TypedPropertyDescriptor<unknown>;
}

describe('ApiTags', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiTags('Users')).toBe('function');
  });

  it('should not throw when invoked', () => {
    const decorator = ApiTags('Users') as unknown as ClassDecorator;

    expect(() => decorator(TestDecoratorTarget)).not.toThrow();
  });
});

describe('ApiBearerAuth', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiBearerAuth()).toBe('function');
  });

  it('should not throw when invoked', () => {
    const decorator = ApiBearerAuth() as unknown as ClassDecorator;

    expect(() => decorator(TestDecoratorTarget)).not.toThrow();
  });
});

describe('ApiProperty', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiProperty()).toBe('function');
  });

  it('should not throw when invoked', () => {
    const decorator = ApiProperty() as unknown as PropertyDecorator;

    expect(() => {
      decorator(TestDecoratorTarget.prototype, 'method');
    }).not.toThrow();
  });
});

describe('ApiPropertyOptional', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiPropertyOptional()).toBe('function');
  });

  it('should not throw when invoked', () => {
    const decorator = ApiPropertyOptional() as unknown as PropertyDecorator;

    expect(() => {
      decorator(TestDecoratorTarget.prototype, 'method');
    }).not.toThrow();
  });
});

describe('ApiOperation', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiOperation({ summary: 'Get one' })).toBe('function');
  });

  it('should not throw when invoked', () => {
    const descriptor = getMethodDescriptor();
    const decorator = ApiOperation({ summary: 'Get one' }) as unknown as MethodDecorator;

    expect(() => decorator(TestDecoratorTarget.prototype, 'method', descriptor)).not.toThrow();
  });
});

describe('ApiResponse', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiResponse({ status: 200 })).toBe('function');
  });

  it('should not throw when invoked', () => {
    const descriptor = getMethodDescriptor();
    const decorator = ApiResponse({ status: 200 }) as unknown as MethodDecorator;

    expect(() => decorator(TestDecoratorTarget.prototype, 'method', descriptor)).not.toThrow();
  });
});

describe('ApiOkResponse', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiOkResponse()).toBe('function');
  });

  it('should not throw when invoked', () => {
    const descriptor = getMethodDescriptor();
    const decorator = ApiOkResponse() as unknown as MethodDecorator;

    expect(() => decorator(TestDecoratorTarget.prototype, 'method', descriptor)).not.toThrow();
  });
});

describe('ApiCreatedResponse', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiCreatedResponse()).toBe('function');
  });

  it('should not throw when invoked', () => {
    const descriptor = getMethodDescriptor();
    const decorator = ApiCreatedResponse() as unknown as MethodDecorator;

    expect(() => decorator(TestDecoratorTarget.prototype, 'method', descriptor)).not.toThrow();
  });
});

describe('ApiNotFoundResponse', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiNotFoundResponse()).toBe('function');
  });

  it('should not throw when invoked', () => {
    const descriptor = getMethodDescriptor();
    const decorator = ApiNotFoundResponse() as unknown as MethodDecorator;

    expect(() => decorator(TestDecoratorTarget.prototype, 'method', descriptor)).not.toThrow();
  });
});

describe('ApiBody', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiBody({ type: String })).toBe('function');
  });

  it('should not throw when invoked', () => {
    const descriptor = getMethodDescriptor();
    const decorator = ApiBody({ type: String }) as unknown as MethodDecorator;

    expect(() => decorator(TestDecoratorTarget.prototype, 'method', descriptor)).not.toThrow();
  });
});

describe('ApiQuery', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiQuery({ name: 'q' })).toBe('function');
  });

  it('should not throw when invoked', () => {
    const descriptor = getMethodDescriptor();
    const decorator = ApiQuery({ name: 'q' }) as unknown as MethodDecorator;

    expect(() => decorator(TestDecoratorTarget.prototype, 'method', descriptor)).not.toThrow();
  });
});

describe('ApiParam', () => {
  it('should return a decorator function', () => {
    expect(typeof ApiParam({ name: 'id' })).toBe('function');
  });

  it('should not throw when invoked', () => {
    const descriptor = getMethodDescriptor();
    const decorator = ApiParam({ name: 'id' }) as unknown as MethodDecorator;

    expect(() => decorator(TestDecoratorTarget.prototype, 'method', descriptor)).not.toThrow();
  });
});
