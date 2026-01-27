import { describe, expect, it } from 'bun:test';

import { uiResponse } from './ui';

describe('ui', () => {
  it('should return an HTML response containing Scalar UI markers when invoked', async () => {
    // Arrange
    const doc = {
      docId: 'x',
      spec: {
        openapi: '3.0.0',
        info: { title: 'T', version: 'V' },
        paths: {},
        components: { schemas: {} },
      },
    };
    // Act
    const res = uiResponse(doc);
    const text = await res.text();

    // Assert
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/i);
    expect(text).toContain('id="api-reference"');
    expect(text).toContain('@scalar/api-reference');
  });
});
