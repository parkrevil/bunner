export class ScalarUiMiddleware {
  constructor(
    private spec: any,
    _options: any,
  ) {}

  handle(_req: Request): Response | Promise<Response> {
    const htmlEmbedded = `
<!doctype html>
<html>
  <head>
    <title>${this.spec.info.title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style> body { margin: 0; } </style>
  </head>
  <body>
    <script
      id="api-reference"
      type="application/json"
      data-spec='${JSON.stringify(this.spec).replace(/'/g, '&apos;')}'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>
    `;

    return new Response(htmlEmbedded, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
