import { describe, expect, it } from 'bun:test';

import type { AdapterCollectionLike, ScalarInput } from './types';

import { resolveHttpNamesForDocuments, resolveHttpNamesForHosting } from './adapter-names';

function makeAdapters(names: string[]): AdapterCollectionLike {
  const group = new Map<string, ScalarInput>();

  for (const name of names) {
    group.set(name, {});
  }

  return { http: group };
}

describe('adapter-names', () => {
  describe('resolveHttpNamesForDocuments', () => {
    it('should return all http adapter names when documentTargets is all', () => {
      // Arrange
      const adapters = makeAdapters(['a', 'b']);
      // Act
      const result = resolveHttpNamesForDocuments(adapters, 'all');

      // Assert
      expect(result).toEqual(['a', 'b']);
    });

    it('should return only http protocol targets when non-http protocols exist', () => {
      // Arrange
      const adapters = makeAdapters(['a', 'b']);
      // Act
      const result = resolveHttpNamesForDocuments(adapters, [
        { protocol: 'tcp', names: ['x'] },
        { protocol: 'http', names: ['b'] },
      ]);

      // Assert
      expect(result).toEqual(['b']);
    });
  });

  describe('resolveHttpNamesForHosting', () => {
    it('should return only selected names when httpTargets are valid', () => {
      // Arrange
      const adapters = makeAdapters(['a', 'b']);
      // Act
      const result = resolveHttpNamesForHosting(adapters, ['b']);

      // Assert
      expect(result).toEqual(['b']);
    });

    it('should throw when httpTargets includes a missing name', () => {
      // Arrange
      const adapters = makeAdapters(['a']);

      // Act
      const act = () => resolveHttpNamesForHosting(adapters, ['a', 'missing']);

      // Assert
      expect(act).toThrow();
    });
  });
});
