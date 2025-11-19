# Bunner Router

A Bun-first HTTP router that builds immutable snapshots up front and executes matches against a compact, cache-friendly layout. The repository is split into `packages/*` workspaces so you can embed the router or exercise it through the example app.

## Highlights

- **Immutable build artifacts** – `RouterBuilder` produces a read-only `RouterInstance` whose static layout can be serialized and shipped between processes.
- **Deterministic build pipeline** – compression, regex validation, wildcard metadata, and route flag calculation all occur inside `build()` so runtime work is minimal.
- **Pluggable cache/observability** – versioned match cache with LRU semantics plus hook bundles for cache hits, param branches, and stage timings.
- **Security-focused decoding** – configurable `%2F` handling, traversal guards, regex safety heuristics, and timeout-aware pattern testers.

## Workspace overview

| Folder                 | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `packages/core`        | Core runtime + injector primitives shared by HTTP server |
| `packages/http-server` | Router, HTTP worker, decorators, and benchmark suite     |
| `examples/`            | Bun app that wires the HTTP server package end-to-end    |

## Snapshot workflow

1. Define your routes and router options inside a manifest (see `packages/http-server/snapshot.manifest.json`).
2. Run the bundled CLI to build and serialize the router snapshot:

   ```bash
   bun packages/http-server/bin/generate-snapshot.ts --manifest packages/http-server/snapshot.manifest.json
   ```

   or, from within `packages/http-server`, simply run:

   ```bash
   bun run snapshot
   ```

3. The CLI writes a JSON payload containing layout arrays, metadata, and param-order snapshots that can be checked into artifacts or pushed to object storage. At runtime, inject the snapshot through `RadixRouterBuilder` or load it when instantiating workers.

## Development scripts

```bash
# Install dependencies
bun install

# Run unit + integration tests
bun test packages/http-server/tests

# Execute the HTTP router benchmarks
cd packages/http-server && bun run bench:router
```

## Example app

`examples/` ships with a Bun application showing how to bootstrap the router package, register modules, and serve HTTP traffic. Install dependencies inside that folder and start the dev server:

```bash
cd examples
bun install
bun run dev
```

## Contributing

- Keep router mutations inside the builder only; `RouterInstance` must stay immutable.
- Favor test coverage under `packages/http-server/tests` before changing core matchers.
- Update `PLAN.md`/`REPORT.md` whenever architectural work completes so downstream consumers have an audit trail.

````bash
```markdown
# Bunner Router

A Bun-first HTTP router that builds immutable snapshots up front and executes matches against a compact, cache-friendly layout. The repository is split into `packages/*` workspaces so you can embed the router or exercise it through the example app.

## Highlights

- **Immutable build artifacts** – `RouterBuilder` produces a read-only `RouterInstance` whose static layout can be serialized and shipped between processes.
- **Deterministic build pipeline** – compression, regex validation, wildcard metadata, and route flag calculation all occur inside `build()` so runtime work is minimal.
- **Pluggable cache/observability** – versioned match cache with LRU semantics plus hook bundles for cache hits, param branches, and stage timings.
- **Security-focused decoding** – configurable `%2F` handling, traversal guards, regex safety heuristics, and timeout-aware pattern testers.

## Workspace overview

| Folder | Purpose |
|--------|---------|
| `packages/core` | Core runtime + injector primitives shared by HTTP server |
| `packages/http-server` | Router, HTTP worker, decorators, and benchmark suite |
| `examples/` | Small Bun app that wires the HTTP server package end-to-end |

## Snapshot workflow

1. Define your routes and router options inside a manifest (see `packages/http-server/snapshot.manifest.json`).
2. Run the bundled CLI to build and serialize the router snapshot:

	```bash
	bun packages/http-server/bin/generate-snapshot.ts --manifest packages/http-server/snapshot.manifest.json
	```

	or, from within `packages/http-server`, simply run:

	```bash
	bun run snapshot
	```

3. The CLI writes a JSON payload containing layout arrays, metadata, and param-order snapshots that can be checked into artifacts or pushed to object storage. At runtime, inject the snapshot through `RadixRouterBuilder` or load it when instantiating workers.

## Development scripts

```bash
# Install dependencies
bun install

# Run unit + integration tests
bun test packages/http-server/tests

# Execute the HTTP router benchmarks
cd packages/http-server && bun run bench:router
````

## Example app

`examples/` ships with a Bun application showing how to bootstrap the router package, register modules, and serve HTTP traffic. Install dependencies inside that folder and start the dev server:

```bash
cd examples
bun install
bun run dev
```

## Contributing

- Keep router mutations inside the builder only; `RouterInstance` must stay immutable.
- Favor test coverage under `packages/http-server/tests` before changing core matchers.
- Update `PLAN.md`/`REPORT.md` whenever architectural work completes so downstream consumers have an audit trail.
