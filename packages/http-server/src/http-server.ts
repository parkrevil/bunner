import { BunnerApplication } from '@bunner/core';

export class HttpServer extends BunnerApplication {
  constructor() {
    super();
  }

  async start() {
    Bun.serve({
      port: 5000,
      fetch: (req, res) => {
        console.log(req.url);
    
        return new Response('Hello, world!');
      },
    });
  }
}
