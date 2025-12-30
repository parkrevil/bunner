# GitHub Copilot Instructions

This repo is SSOT-driven. Follow [AGENTS.md](../AGENTS.md) exactly.

## Quick Reference

### Hard Stops (즉시 중단)

| Category     | Condition                                        |
| ------------ | ------------------------------------------------ |
| **Security** | Sensitive info (keys/tokens) in code             |
| **AOT**      | `reflect-metadata` or runtime reflection         |
| **AOT**      | Non-deterministic outputs (time/random)          |
| **Boundary** | Cross-package deep import (`@bunner/pkg/src/**`) |
| **Boundary** | Circular dependencies                            |
| **Contract** | Public Facade change without approval            |
| **Contract** | Silent breaking change                           |

### Pre-action Checklist

- [ ] Is scope clear? → If not, ask
- [ ] Cross package boundaries? → Request approval
- [ ] Public API change? → Request approval
- [ ] Test needed? → Add test

### Task Execution Protocol

See: [.agent/workflows/complex-task.md](../.agent/workflows/complex-task.md)

| Phase     | Action                                |
| --------- | ------------------------------------- |
| Discovery | Ask questions if ambiguous            |
| Alignment | Summarize and confirm                 |
| Planning  | Present execution plan (see template) |
| Execution | Start after approval only             |

Template: [.agent/templates/execution-plan.md](../.agent/templates/execution-plan.md)

**Exception**: Skip phases 1-3 for simple, clear, single-file tasks.

## Repo Architecture

- Monorepo with Bun workspaces
- Runtime: `@bunner/common`, `@bunner/logger`, `@bunner/core`, `@bunner/http-adapter`, `@bunner/scalar`
- Tooling: `@bunner/cli` (must not depend on runtime packages)
- Facades: `packages/<pkg>/index.ts` = public API

## Workflows

```bash
bun run verify     # All checks (tsc + lint + test)
bun run tsc        # Typecheck
bun run lint       # Lint
bun test           # Tests
```

## SSOT Documents

| Purpose              | Document                                                                |
| -------------------- | ----------------------------------------------------------------------- |
| Agent rules (full)   | [AGENTS.md](../AGENTS.md)                                               |
| Top-level invariants | [SPEC.md](../SPEC.md)                                                   |
| Package boundaries   | [ARCHITECTURE.md](../ARCHITECTURE.md)                                   |
| Coding style         | [STYLEGUIDE.md](../STYLEGUIDE.md)                                       |
| Stop conditions      | [POLICY.md](../POLICY.md)                                               |
| Approval required    | [GOVERNANCE.md](../GOVERNANCE.md)                                       |
| Complex tasks        | [.agent/workflows/complex-task.md](../.agent/workflows/complex-task.md) |
