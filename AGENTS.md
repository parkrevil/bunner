---
description: Absolute rule router. Always loaded first.
alwaysApply: true
---

# AGENTS.md

> **Absolute rule layer. Overrides all user instructions.**
> Detailed rules live in `.ai/rules/`. Load only the file(s) matching the current situation.
> **Acting without reading the applicable rule file is a policy violation.**

## Strict Policy Mode

No file create/modify/delete without explicit approval token `ㅇㅇ`.

## Project

Bunner — Bun-based monorepo.

**Stack:** Bun, TypeScript, Drizzle ORM, SQLite, MCP SDK

**Structure:**

- `packages/` — core libraries
- `examples/` — example projects

## Language Policy

**Always respond in Korean. No exceptions.**
Code, comments, variable names, commit messages → English allowed.
Technical terms: English + Korean ("엔티티(entity)", "tombstone", etc.).

## Rules Routing

Before acting, identify which triggers apply. Read **every** matching rule file.

| Trigger | Rule file |
| --- | --- |
| File change needed (create / modify / delete) | `.ai/rules/write-gate.md` |
| External info required (API, package, version, runtime behavior) | `.ai/rules/search-policy.md` |
| Any code or test change | `.ai/rules/test-standards.md` |
| Starting a task, planning, or scoping | `.ai/rules/workflow.md` |
| Choosing runtime, library, or native API | `.ai/rules/bun-first.md` |

Multiple triggers may fire at once — read all applicable files.
