import { isRecord } from '../common/guards';

import type { Doc } from './interfaces';

export function uiResponse(doc: Doc): Response {
  let title = 'API Docs';

  const spec = doc.spec;

  if (isRecord(spec)) {
    const info = spec['info'];

    if (isRecord(info)) {
      const rawTitle = info['title'];

      if (typeof rawTitle === 'string' && rawTitle.length > 0) {
        title = rawTitle;
      }
    }
  }

  const embedded = JSON.stringify(spec).replace(/'/g, '&apos;');

  const html = `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style> body { margin: 0; } </style>
  </head>
  <body>
    <script
      id="api-reference"
      type="application/json"
      data-spec='${embedded}'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
