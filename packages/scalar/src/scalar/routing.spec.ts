import { describe, expect, it } from 'bun:test';

import { resolveDocFromPath } from './routing';

describe('routing', () => {
  it('should return null when the path does not start with /api-docs/', () => {
    // Arrange
    const path = '/';
    // Act
    const result = resolveDocFromPath(path);

    // Assert
    expect(result).toBeNull();
  });

  it('should return null when the path is exactly /api-docs', () => {
    // Arrange
    const path = '/api-docs';
    // Act
    const result = resolveDocFromPath(path);

    // Assert
    expect(result).toBeNull();
  });

  it('should return null when the /api-docs prefix is missing', () => {
    // Arrange
    const path = '/api';
    // Act
    const result = resolveDocFromPath(path);

    // Assert
    expect(result).toBeNull();
  });

  it('should parse the json variant when the suffix ends with .json', () => {
    // Arrange
    const path = '/api-docs/openapi:http:main.json';
    // Act
    const result = resolveDocFromPath(path);

    // Assert
    expect(result).toEqual({
      docId: 'openapi:http:main',
      isJson: true,
    });
  });

  it('should parse the html variant when the suffix has no extension', () => {
    // Arrange
    const path = '/api-docs/openapi:http:main';
    // Act
    const result = resolveDocFromPath(path);

    // Assert
    expect(result).toEqual({
      docId: 'openapi:http:main',
      isJson: false,
    });
  });

  it('should decode URL-encoded docId when the suffix is encoded', () => {
    // Arrange
    const path = '/api-docs/openapi%3Ahttp%3Amain.json';
    // Act
    const result = resolveDocFromPath(path);

    // Assert
    expect(result).toEqual({
      docId: 'openapi:http:main',
      isJson: true,
    });
  });
});
