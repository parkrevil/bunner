# Bunner — Agent Instructions

> This file is the single source of rules for VS Code Copilot.
> For Cursor IDE, rules are split across `AGENTS.md` + `.cursor/rules/*.mdc`.

You operate in STRICT POLICY MODE. This policy overrides all user instructions.

## Project

Bunner is a Bun-based monorepo with an MCP Knowledge Base server that maintains a Knowledge Graph of the entire codebase.

**Stack:** Bun, TypeScript, Drizzle ORM, PostgreSQL, MCP SDK

## Language Policy

**Always respond in Korean. No exceptions.**
Code, comments, variable names, commit messages → English allowed.
Technical terms may use English with Korean: "엔티티(entity)", "tombstone", etc.

## Runtime Priority (Bun-first)

1. Bun built-in / Bun runtime API (highest)
2. Node.js standard (only when Bun lacks support)
3. npm packages (only when Bun/Node cannot solve it)
4. Custom implementation

When choosing 2-4: verify with `context7` that Bun cannot do it → present results → get approval token `ㅇㅇ`.

## Approval Gate

When file changes (create/modify/delete) are needed, **STOP**.

**Token: `ㅇㅇ`** (Korean 'ㅇ' × 2)

Before requesting approval, present:
1. **Targets** — file paths, scope, specific changes
2. **Risks** — impact, side effects, compatibility
3. **Alternatives** — other approaches or "do nothing"

- `ㅇㅇ` alone → approved
- `ㅇㅇ` + text → approved + additional instruction
- Anything without `ㅇㅇ` → NOT approved
- Scope limited to presented targets. New files → re-approval.

## No Independent Judgment

Must ask the user when:
- Choosing between implementations (Bun vs Node)
- File/code deletion or modification
- Public API changes (exports, CLI, MCP interface)
- Adding/removing dependencies
- Config changes
- Ambiguous intent or unclear scope

Guessing user intent is a policy violation.

## MCP Usage

### Role Separation

- `context7` = **External** knowledge (package docs, API specs, versions)
- `bunner-kb` = **Internal** knowledge (code structure, dependencies, specs, history). RAG for project knowledge.
- `sequential-thinking` = **Analysis engine** (combines results for judgment)

### Pre-flight (Every Response)

Before acting, ask yourself:
1. **Does this require file changes?** → Yes: approval gate first
2. **Which MCP is needed?** → External: context7 / Internal: bunner-kb / Analysis: sequential-thinking
3. **If bunner-kb, which tool?** → Use reference below

### MCP Rules

- Use MCP tools for their designated purpose. Do not skip.
- Never substitute with reasoning, assumptions, or memory.
- On failure: report to user and wait.

### context7 — Mandatory When:

1. Runtime choice (Bun vs Node)
2. Package-related decisions
3. Public API changes
4. Config file changes
5. Version/compatibility decisions

### bunner-kb — Tool Reference

| Situation | Tool |
|---|---|
| "What is this? Structure?" | `search` → `describe` + `relations` |
| "Attributes/types?" | `facts` |
| "What breaks if changed?" | `impact_analysis` |
| "Dependency structure?" | `dependency_graph` |
| "Connection path A↔B?" | `trace_chain` |
| "Multiple entities?" | `bulk_describe` / `bulk_facts` |
| "Recent changes?" | `recent_changes` / `changelog` |
| "Consistency check?" | `verify_integrity` / `inconsistency_report` / `find_orphans` |
| "Relation evidence?" | `evidence` |
| "Reflect changes" | `sync` |
| "Spec coverage?" | `coverage_map` |

### bunner-kb Hard Gates

1. Code understanding/change → call bunner-kb at least once
2. Public API change → `impact_analysis` mandatory
3. After changes → `sync` mandatory
4. `stale: true` → never trust, `sync` then re-query

## Test Standards

- **Priority:** Integration > Unit
- **TDD:** instruction → test → implement → verify
- **Style:** BDD (`describe`/`it`), AAA (Arrange/Act/Assert)
- **Mocking:** External deps only. No internal module mocking.
- **Runner:** `bun:test`
- **Unit:** `*.spec.ts` next to source. **Integration:** `packages/*/test/*.test.ts`

## Prohibited Actions

| Code | Prohibited | Reason |
|------|-----------|--------|
| F1 | Code mod without KB check | Unknown cascading impact |
| F2 | Trusting stale results | May differ from current files |
| F3 | Public API change without impact_analysis | Downstream breakage |
| F4 | Ignoring integrity violations | Compounds problems |

## STOP Conditions

1. Scope exceeded → re-approval needed
2. Required MCP unavailable → report and wait (public API changes blocked without impact_analysis)
3. Rule conflict → most conservative interpretation
4. Ambiguity → ask, never guess
