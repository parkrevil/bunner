import { describe, expect, it } from 'bun:test';

import { resolveDocFromPath } from './routing';

describe('resolveDocFromPath', () => {
  it('should return null when path does not start with /api-docs/', () => {
    expect(resolveDocFromPath('/')).toBeNull();
  });

  it('should return null when path is exactly /api-docs', () => {
    expect(resolveDocFromPath('/api-docs')).toBeNull();
  });

  it('should return null when /api-docs prefix is missing', () => {
    expect(resolveDocFromPath('/api')).toBeNull();
  });

  it('should parse json variant and set isJson=true', () => {
    expect(resolveDocFromPath('/api-docs/openapi:http:main.json')).toEqual({
      docId: 'openapi:http:main',
      isJson: true,
    });
  });

  it('should parse html variant and set isJson=false', () => {
    expect(resolveDocFromPath('/api-docs/openapi:http:main')).toEqual({
      docId: 'openapi:http:main',
      isJson: false,
    });
  });

  it('should decode URL-encoded docId', () => {
    expect(resolveDocFromPath('/api-docs/openapi%3Ahttp%3Amain.json')).toEqual({
      docId: 'openapi:http:main',
      isJson: true,
    });
  });
});
