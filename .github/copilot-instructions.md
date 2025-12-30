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

#### Phase 1: Discovery

- If request is ambiguous, **ask questions first** (MUST)
- Gather: purpose, scope, constraints, priorities

#### Phase 2: Alignment

- Summarize understanding and **confirm with user**
- Do NOT proceed without explicit "yes/go ahead"

#### Phase 3: Planning

For complex tasks, present execution plan:

```markdown
## 📋 Execution Plan

### Goal

[What to achieve]

### Non-Goals

[What NOT to do]

### Steps

1. [ ] Step 1
2. [ ] Step 2

### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

#### Phase 4: Execution

- Start only after user approval (MUST)
- Stop immediately if unplanned changes needed

#### Exception: Simple Tasks

Skip phases 1-3 if ALL conditions met:

- Request is clear and specific
- Scope is single file or obviously limited
- No architecture/Public API changes

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

| Purpose              | Document                              |
| -------------------- | ------------------------------------- |
| Agent rules (full)   | [AGENTS.md](../AGENTS.md)             |
| Top-level invariants | [SPEC.md](../SPEC.md)                 |
| Package boundaries   | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Coding style         | [STYLEGUIDE.md](../STYLEGUIDE.md)     |
| Stop conditions      | [POLICY.md](../POLICY.md)             |
| Approval required    | [GOVERNANCE.md](../GOVERNANCE.md)     |
