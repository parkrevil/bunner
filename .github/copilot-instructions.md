# Bunner AI Coding Agent Instructions

This repo is SSOT-driven. Follow the documents below exactly; do not invent new patterns.

## SSOT order (read before changing behavior)

- Top-level invariants: [SPEC.md](../SPEC.md)
- Package boundaries + responsibilities: [ARCHITECTURE.md](../ARCHITECTURE.md)
- Placement/layout rules: [STRUCTURE.md](../STRUCTURE.md)
- Dependency declaration policy: [DEPENDENCIES.md](../DEPENDENCIES.md)
- CLI/AOT operations policy: [TOOLING.md](../TOOLING.md)
- Coding + naming rules: [STYLEGUIDE.md](../STYLEGUIDE.md)
- Tests as a gate: [TESTING.md](../TESTING.md)
- Agent enforcement rules: [AGENTS.md](../AGENTS.md)
- Stop/rollback criteria: [POLICY.md](../POLICY.md), [SAFEGUARDS.md](../SAFEGUARDS.md)
- Dead code removal: [DEAD_CODE_POLICY.md](../DEAD_CODE_POLICY.md)
- Commit conventions: [COMMITS.md](../COMMITS.md)
- Contributions: [CONTRIBUTING.md](../CONTRIBUTING.md)

## Non-negotiables (hard stops)

- Do not introduce runtime scanning/reflection; `reflect-metadata` is forbidden.
- Runtime must not mutate `globalThis.__BUNNER_METADATA_REGISTRY__`; it is produced by CLI and only consumed.
- Do not add cross-package deep imports (never import another package’s `src/**`).
- Do not introduce circular dependencies; treat cycles as failures.
- Do not change public facade contracts without an explicit user request.

## Repo architecture (big picture)

- Monorepo with Bun workspaces: `packages/*` are publishable units; `examples/` is a consumer app.
- Runtime packages: `@bunner/common`, `@bunner/logger`, `@bunner/core`, `@bunner/http-adapter`, `@bunner/scalar`.
- Tooling package: `@bunner/cli` (AOT/analyzer/generator). CLI must not depend on runtime implementation packages.
- Facades are strict:
  - `packages/<pkg>/index.ts` is the public facade.
  - `packages/<pkg>/src/index.ts` is the internal facade.
  - Cross-feature imports must go via `src/<feature>/index.ts` (no direct file imports across features).

## Workflows (commands)

- Typecheck: `bun run tsc`
- Lint (autofix): `bun run lint`
- Tests: `bun test`
- Architecture gate: `bun run architecture:check`

## Project-specific conventions

- Filenames are `kebab-case` except reserved files like `index.ts`, `types.ts`, `interfaces.ts`, `*.spec.ts`.
- No non-TSDoc comments in code; public APIs must have TSDoc.
- Tests must use Bun’s test runner and BDD naming: `it('should ...', ...)`.

## Contracts to treat as public

- Treat package root facades (`packages/<pkg>/index.ts`) and documented APIs as contracts.
- For Scalar, the public API is documented in [packages/scalar/README.md](../packages/scalar/README.md).
