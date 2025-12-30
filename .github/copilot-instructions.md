# Bunner AI Coding Agent Instructions

This repo is SSOT-driven. Follow the documents below exactly; do not invent new patterns.

## SSOT order (read before changing behavior)

1. [SPEC.md](../SPEC.md) - Top-level invariants
2. [AGENTS.md](../AGENTS.md) - Agent enforcement rules
3. [ARCHITECTURE.md](../ARCHITECTURE.md) - Package boundaries + responsibilities
4. [STRUCTURE.md](../STRUCTURE.md) - Placement/layout rules
5. [STYLEGUIDE.md](../STYLEGUIDE.md) - Coding + naming rules

Other documents:

- [DEPENDENCIES.md](../DEPENDENCIES.md) - Dependency declaration policy
- [TOOLING.md](../TOOLING.md) - CLI/AOT operations policy
- [TESTING.md](../TESTING.md) - Tests as a gate
- [POLICY.md](../POLICY.md), [SAFEGUARDS.md](../SAFEGUARDS.md) - Stop/rollback criteria
- [GOVERNANCE.md](../GOVERNANCE.md) - Approval required changes
- [DEAD_CODE_POLICY.md](../DEAD_CODE_POLICY.md) - Dead code removal
- [COMMITS.md](../COMMITS.md) - Commit conventions
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributions

## Hard Stops (즉시 중단)

| Category     | Condition                                              |
| ------------ | ------------------------------------------------------ |
| **Security** | Sensitive info (keys/tokens) in code                   |
| **AOT**      | `reflect-metadata` or runtime reflection               |
| **AOT**      | Non-deterministic outputs (time/random dependent)      |
| **Boundary** | Cross-package deep import (`@bunner/pkg/src/**`)       |
| **Boundary** | Circular dependencies                                  |
| **Contract** | Public Facade change without approval                  |
| **Contract** | Silent breaking change (same type, different behavior) |

## Pre-action Checklist

- [ ] Is scope clear? → If not, ask for clarification
- [ ] Does this cross package boundaries? → Request approval
- [ ] Does this change Public API? → Request approval
- [ ] Is a test needed? → Add test

## Repo Architecture

- Monorepo with Bun workspaces: `packages/*` are publishable units; `examples/` is a consumer app.
- Runtime: `@bunner/common`, `@bunner/logger`, `@bunner/core`, `@bunner/http-adapter`, `@bunner/scalar`
- Tooling: `@bunner/cli` (AOT/analyzer/generator). CLI must not depend on runtime packages.
- Facades:
  - `packages/<pkg>/index.ts` = public facade
  - `packages/<pkg>/src/index.ts` = internal facade
  - Cross-feature imports via `src/<feature>/index.ts` only

## Workflows

```bash
bun run verify     # All checks (tsc + lint + test)
bun run tsc        # Typecheck
bun run lint       # Lint (autofix)
bun test           # Tests
bun run architecture:check  # Architecture gate
```

## Project Conventions

- Filenames: `kebab-case` (exceptions: `index.ts`, `types.ts`, `interfaces.ts`, `*.spec.ts`)
- No comments except TSDoc on public APIs
- Tests: BDD naming (`it('should ...', ...)`)
- No `any`/`unknown` unless absolutely necessary

## Public Contracts

- Package root facades: `packages/<pkg>/index.ts`
- Documented APIs in README files
- For Scalar: [packages/scalar/README.md](../packages/scalar/README.md)
