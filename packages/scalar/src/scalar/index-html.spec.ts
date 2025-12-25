import { describe, expect, it } from 'bun:test';

import { createIndexHtml } from './index-html';

describe('createIndexHtml', () => {
  it('should render links to UI and JSON routes', () => {
    const html = createIndexHtml([
      { docId: 'openapi:http:main', spec: {} },
      { docId: 'openapi:http:admin', spec: {} },
    ]);

    expect(html).toContain('/api-docs/openapi%3Ahttp%3Amain');
    expect(html).toContain('/api-docs/openapi%3Ahttp%3Amain.json');
    expect(html).toContain('/api-docs/openapi%3Ahttp%3Aadmin');
  });
});
