# Examples

This folder contains a minimal Bun application that consumes `@bunner/http-server` end-to-end. It demonstrates how to boot the router builder, register feature modules, and host the HTTP worker inside a Bun runtime.

## Setup

```bash
bun install
```

## Running locally

```bash
# Start the dev server with hot reload
bun run dev

# Or execute the compiled entrypoint directly
bun run src/main.ts
```

## Integrating router snapshots

1. Generate a snapshot from the parent workspace (see `packages/http-server/snapshot.manifest.json`).
2. Copy the emitted JSON into `examples/dist/router-snapshot.json`.
3. Update the bootstrap code to hydrate the snapshot instead of rebuilding during startup when you want to mimic production deployments.

## Notes

- The example intentionally keeps dependencies light so you can copy/paste snippets into your own Bun services.
- Update this folder whenever a breaking change lands in `@bunner/http-server` so it continues to serve as a living integration test.
