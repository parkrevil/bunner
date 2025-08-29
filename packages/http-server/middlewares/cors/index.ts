console.log("Hello via Bun!");

Bun.serve({
  port: 3000,
  hostname: "0.0.0.0",
  fetch(req) {
    return new Response("Hello via Bun!");
  },
});
