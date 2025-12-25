import { describe, expect, it } from 'bun:test';

import { uiResponse } from './ui';

describe('uiResponse', () => {
  it('should return an HTML response containing Scalar UI markers', async () => {
    const res = uiResponse({ docId: 'x', spec: { info: { title: 'T' } } });

    expect(res.headers.get('Content-Type')).toMatch(/text\/html/i);

    const text = await res.text();

    expect(text).toContain('id="api-reference"');
    expect(text).toContain('@scalar/api-reference');
  });
});
