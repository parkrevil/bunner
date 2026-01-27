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
  method(_arg?: string): void {}
}

function getMethodDescriptor(): PropertyDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(TestDecoratorTarget.prototype, 'method');

  if (!descriptor) {
    throw new Error('Expected method descriptor to exist');
  }

  return descriptor;
}

describe('decorators', () => {
  describe('ApiTags', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      const tag = 'Users';
      // Act
      const decorator = ApiTags(tag);

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const decorator = ApiTags('Users');

      // Act
      const act = () => decorator(TestDecoratorTarget);

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiBearerAuth', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      // Act
      const decorator = ApiBearerAuth();

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const decorator = ApiBearerAuth();

      // Act
      const act = () => decorator(TestDecoratorTarget);

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiProperty', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      // Act
      const decorator = ApiProperty();

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const decorator = ApiProperty();

      // Act
      const act = () => {
        decorator(TestDecoratorTarget.prototype, 'method');
      };

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiPropertyOptional', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      // Act
      const decorator = ApiPropertyOptional();

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const decorator = ApiPropertyOptional();

      // Act
      const act = () => {
        decorator(TestDecoratorTarget.prototype, 'method');
      };

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiOperation', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      const options = { summary: 'Get one' };
      // Act
      const decorator = ApiOperation(options);

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const descriptor = getMethodDescriptor();
      const decorator = ApiOperation({ summary: 'Get one' });

      // Act
      const act = () => decorator(TestDecoratorTarget.prototype, 'method', descriptor);

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiResponse', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      const options = { status: 200 };
      // Act
      const decorator = ApiResponse(options);

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const descriptor = getMethodDescriptor();
      const decorator = ApiResponse({ status: 200 });

      // Act
      const act = () => decorator(TestDecoratorTarget.prototype, 'method', descriptor);

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiOkResponse', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      // Act
      const decorator = ApiOkResponse();

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const descriptor = getMethodDescriptor();
      const decorator = ApiOkResponse();

      // Act
      const act = () => decorator(TestDecoratorTarget.prototype, 'method', descriptor);

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiCreatedResponse', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      // Act
      const decorator = ApiCreatedResponse();

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const descriptor = getMethodDescriptor();
      const decorator = ApiCreatedResponse();

      // Act
      const act = () => decorator(TestDecoratorTarget.prototype, 'method', descriptor);

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiNotFoundResponse', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      // Act
      const decorator = ApiNotFoundResponse();

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const descriptor = getMethodDescriptor();
      const decorator = ApiNotFoundResponse();

      // Act
      const act = () => decorator(TestDecoratorTarget.prototype, 'method', descriptor);

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiBody', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      const options = { type: String };
      // Act
      const decorator = ApiBody(options);

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const descriptor = getMethodDescriptor();
      const decorator = ApiBody({ type: String });

      // Act
      const act = () => decorator(TestDecoratorTarget.prototype, 'method', descriptor);

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiQuery', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      const options = { name: 'q' };
      // Act
      const decorator = ApiQuery(options);

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const descriptor = getMethodDescriptor();
      const decorator = ApiQuery({ name: 'q' });

      // Act
      const act = () => decorator(TestDecoratorTarget.prototype, 'method', descriptor);

      // Assert
      expect(act).not.toThrow();
    });
  });

  describe('ApiParam', () => {
    it('should return a decorator function when invoked', () => {
      // Arrange
      const options = { name: 'id' };
      // Act
      const decorator = ApiParam(options);

      // Assert
      expect(typeof decorator).toBe('function');
    });

    it('should not throw when the decorator is applied', () => {
      // Arrange
      const descriptor = getMethodDescriptor();
      const decorator = ApiParam({ name: 'id' });

      // Act
      const act = () => decorator(TestDecoratorTarget.prototype, 'method', descriptor);

      // Assert
      expect(act).not.toThrow();
    });
  });
});
