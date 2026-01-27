import { describe, expect, it } from 'bun:test';

import { createIndexHtml } from './index-html';

describe('index-html', () => {
  it('should render links to UI and JSON routes when docs are provided', () => {
    // Arrange
    const spec = {
      openapi: '3.0.0',
      info: { title: 'T', version: 'V' },
      paths: {},
      components: { schemas: {} },
    };
    const docs = [
      { docId: 'openapi:http:main', spec },
      { docId: 'openapi:http:admin', spec },
    ];
    // Act
    const html = createIndexHtml(docs);

    // Assert
    expect(html).toContain('/api-docs/openapi%3Ahttp%3Amain');
    expect(html).toContain('/api-docs/openapi%3Ahttp%3Amain.json');
    expect(html).toContain('/api-docs/openapi%3Ahttp%3Aadmin');
  });
});
