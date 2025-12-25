import type { Doc } from './interfaces';

export function createIndexHtml(docs: Doc[]): string {
  const links = docs
    .map(d => {
      const href = `/api-docs/${encodeURIComponent(d.docId)}`;
      const jsonHref = `/api-docs/${encodeURIComponent(d.docId)}.json`;

      return `<li><a href="${href}">${d.docId}</a> — <a href="${jsonHref}">json</a></li>`;
    })
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Docs</title>
  </head>
  <body>
    <h1>API Docs</h1>
    ${docs.length > 0 ? `<ul>${links}</ul>` : '<p>No documents.</p>'}
  </body>
</html>`;
}

export function indexResponse(docs: Doc[]): Response {
  return new Response(createIndexHtml(docs), {
    headers: { 'Content-Type': 'text/html' },
  });
}
