# Card-centric Knowledge Base Design v5 (Git-first + File SSOT + SQLite Index)

> **Scope**: Next-gen bunner KB architecture optimized for vibe-coding agents
> **Status**: Draft v5.1 — 2026-02-11
> **Core idea**: **Git is the source of truth** (cards are files with frontmatter metadata + body spec). **SQLite is a disposable local index (gitignored, always rebuildable)** for ultra-fast agent traversal.
> **Where it lives**: bunner **CLI package** — CLI and MCP share the same core logic.
> **Compatibility**: v4 (PostgreSQL SSOT) remains valid; v5 is an alternative architecture (not a minor revision)

**Out of scope**: `docs/` (do not reference it; it will be deleted)

---

## 1. Problem Statement (Reframed)

### 1.1 What we want

During vibe-coding, an agent must be able to answer quickly:

- “What requirement(card) does this code implement?”
- “What code implements this card?”
- “What other cards depend on this?”
- “What code is adjacent/impacted?”

And the answer must be:

- **Fast** (sub-100ms interactive)
- **Branch-safe** (Git branches naturally isolate)
- **Merge-safe** (Git merge resolves conflicts)
- **Low-ops** (no always-on shared DB requirement)

### 1.2 Why v4 feels heavy in this context

v4 optimizes for:

- Shared DB SSOT (PostgreSQL)
- Strong DB-enforced constraints + governance logs in DB
- Multi-tenant/team-real-time collaboration

v5 optimizes for:

- **Git-native collaboration**: history/rollback/branch/merge are solved by Git
- **Local-first indexing**: build a local graph index for agent reads

---

## 2. v5 Design Goals

1. **Git-first SSOT**: Card files (frontmatter + body) are Git-tracked, human-reviewable, mergeable.
2. **SQLite index**: Disposable local cache (gitignored). Provides high-performance traversal/search. Always rebuildable.
3. **CLI + MCP share core**: Both interfaces invoke the same core logic for reads and writes. Framework authors may use MCP exclusively; end-users may use CLI.
4. **MCP embedded**: MCP server is a CLI subcommand (`bunner kb serve`). MCP write tools are **required** (not deferred).
5. **AOT/AST (oxc-parser only)**: Reuse existing CLI `oxc-parser` pipeline. No TypeScript Compiler API dependency.
6. **Call-level code relations**: Code↔code relations include imports, calls, extends, implements, DI inject/provide — all statically extractable via AST.
7. **Dual audience**: Must serve both the framework author (building bunner itself via vibe-coding/MCP) and framework users (who get richer features including framework rules via MCP).
8. **No "snapshot export/import" as a workflow**: the SSOT is the files themselves.

---

## 3. High-Level Architecture

### 3.1 Source-of-truth layers

- **SSOT (Git-tracked)**: `.bunner/cards/**/*.card.md` (frontmatter=metadata, body=spec) + **mandatory** in-code card links (JSDoc `@see {type}::key`)
- **Derived local index (gitignored)**: `.bunner/.cache/kb.sqlite`

```
repo/
  .bunner/
    cards/                 # SSOT: card files (frontmatter + body)
    schema/                # SSOT: format/versioning metadata
    .cache/                # gitignored
      kb.sqlite            # Derived index for fast queries
  bunner.config.ts         # Exclusion globs, card types, target paths
  src/
    ...                    # Code SSOT
```

### 3.2 Read vs Write paths

- **Reads** (agent tools): always serve from SQLite index
- **Writes** (human/agent via CLI or MCP): modify SSOT files (cards / code annotations) via shared core logic, then re-index

CLI and MCP invoke the **same core** for writes (AST-safe edits, card CRUD, re-index).
The SQLite DB is always rebuildable.

---

## 4. SSOT File Model

### 4.1 Cards as files

Cards are stored as Markdown files with **frontmatter (metadata) + body (spec content only)**.

Path convention:

- `.bunner/cards/auth.card.md`
- `.bunner/cards/auth/login.card.md`

This is a filesystem hierarchy for organization. Logical relationships are stored in frontmatter, not directory structure.

### 4.2 Card types

Cards have a `type` field. The type determines the JSDoc link prefix: `@see {type}::key`.

Built-in types (minimum):

| Type | Purpose |
|------|----------||
| `spec` | Feature/requirement specification |
| `system` | Framework-level rule (shipped with bunner) |
| `adapter` | Adapter-specific rule (shipped with adapter packages) |

Additional types can be registered in `bunner.config.ts`:

```typescript
export default {
  cardTypes: ['spec', 'system', 'adapter', 'rule', 'guide'],
};
```

Only registered types are valid. Unregistered type prefixes in `@see` are errors.

### 4.3 Card frontmatter

```yaml
---
key: spec::auth/login
type: spec
summary: OAuth login
status: draft              # draft | accepted | implementing | implemented | deprecated
tags: [auth, mvp]          # optional, multiple
subjects: [authentication] # optional, multiple (broad categorization)
constraints:               # optional (spec-specific constraints, brief)
  - latency < 200ms
  - PII must be masked
relations:                 # optional (graph edges to other cards)
  - type: depends_on
    target: spec::auth/session
  - type: references
    target: system::di/injection
  - type: related
    target: spec::auth/token-refresh
---
```

**Body** contains **spec content only**. No AC checklists, no style guides, no tutorials. Completion is determined by `status` transitions.

### 4.4 Relationship model (graph/web, no tree)

- **No `parent` field**. No forced tree hierarchy.
- All card↔card relationships are **typed edges** stored in frontmatter `relations[]`.
- Relationship types are extensible. Minimum set:
- `relations[].type` is an allowlist of edge kinds. Minimum set:

| Type | Meaning |
|------|---------||
| `depends_on` | Prerequisite / blocking |
| `references` | Weak reference / background |
| `related` | Associated (non-directional) |
| `extends` | Refinement / elaboration |
| `conflicts` | Contradicts / clashes |

- Start with R1 (frontmatter). Migrate to R2 (separate files) if merge conflicts become frequent.

### 4.5 Card↔Code links (strict)

**Hard rule (v5)**: every `*.ts` file MUST declare at least one card link.

- Applies to: `**/*.ts`
- Excludes by default: `**/*.d.ts`
- **No `.tsx`** (backend framework — not applicable)
- **No in-code ignore tokens** (`@bunner-ignore-*` is prohibited — agents will abuse it)
- Exclusion rules are managed **only** via `bunner.config.ts` globs or CLI options

Canonical syntax (file-level, mandatory):

```ts
/**
 * @see spec::auth/login
 */
```

Multiple links / symbol-level (when needed):

```ts
/**
 * @see spec::auth/login
 * @see spec::auth/session
 */
export function handleOAuthCallback() {}
```

Framework-shipped cards use their type prefix:

```ts
/**
 * @see system::di/injection
 * @see adapter::express/middleware
 */
```

Notes:

- JSDoc contains **only the card key reference** (no spec duplication). The card file remains SSOT for spec content.
- Link insertion is supported via CLI/MCP core (AST-safe edit).

---

## 5. Local SQLite Index Model (Derived)

### 5.1 Purpose

SQLite index exists only to make agent queries fast:

- `search`
- `get_context`
- `get_subgraph`

It must be rebuildable from:

- `.bunner/cards/**/*.card.md`
- code files under `src/` (or configured roots)

### 5.2 Tables (domain-separated)

```sql
-- Card metadata (parsed from frontmatter)
card(
  key           TEXT PRIMARY KEY,  -- e.g. 'spec::auth/login'
  type          TEXT NOT NULL,     -- e.g. 'spec', 'system', 'adapter'
  summary       TEXT NOT NULL,
  status        TEXT NOT NULL,     -- draft|accepted|implementing|implemented|deprecated
  tags_json     TEXT,              -- JSON array
  subjects_json TEXT,              -- JSON array
  constraints_json TEXT,           -- JSON array
  body          TEXT,              -- raw markdown body
  file_path     TEXT NOT NULL,     -- source .card.md path
  updated_at    TEXT NOT NULL
)

-- Code entities (parsed from AST)
code_entity(
  entity_key    TEXT PRIMARY KEY,  -- e.g. 'symbol:src/auth/login.ts#handleOAuth'
  file_path     TEXT NOT NULL,
  symbol_name   TEXT,
  kind          TEXT NOT NULL,     -- module|class|function|variable|...
  signature     TEXT,
  content_hash  TEXT NOT NULL,
  updated_at    TEXT NOT NULL
)

-- Card↔Card relations (parsed from frontmatter relations[])
card_relation(
  id            INTEGER PRIMARY KEY,
  type          TEXT NOT NULL,     -- depends_on|references|related|extends|conflicts
  src_card_key  TEXT NOT NULL REFERENCES card(key),
  dst_card_key  TEXT NOT NULL REFERENCES card(key),
  meta_json     TEXT
)

-- Card↔Code links (parsed from JSDoc @see {type}::key)
card_code_link(
  id            INTEGER PRIMARY KEY,
  type          TEXT NOT NULL,     -- see (all card↔code links are represented as @see)
  card_key      TEXT NOT NULL REFERENCES card(key),
  entity_key    TEXT REFERENCES code_entity(entity_key),
  file_path     TEXT NOT NULL,
  symbol_name   TEXT,
  meta_json     TEXT
)

-- Code↔Code relations (extracted by AST pipeline)
code_relation(
  id              INTEGER PRIMARY KEY,
  type            TEXT NOT NULL,   -- imports|calls|extends|implements|injects|provides
  src_entity_key  TEXT NOT NULL REFERENCES code_entity(entity_key),
  dst_entity_key  TEXT NOT NULL REFERENCES code_entity(entity_key),
  meta_json       TEXT
)

-- File state (for incremental indexing)
file_state(
  path            TEXT PRIMARY KEY,
  content_hash    TEXT NOT NULL,
  mtime           TEXT NOT NULL,
  last_indexed_at TEXT NOT NULL
)

-- FTS5 virtual tables for full-text search on card body + code symbols
```

### 5.3 Identity strategy (simplified)

v5 aims to avoid heavy identity/version machinery.

- Cards: identity is `card.key` (e.g. `spec::auth/login`). Key is defined in frontmatter and is immutable by policy.
- Code: identity is `entity_key` derived from AST:
  - module: `module:{relativePath}`
  - symbol: `symbol:{relativePath}#{symbolName}`

**Why path-based is acceptable in v5**:
- card↔code links are in-code JSDoc annotations, so when the file moves, the annotation moves.
- the indexer recomputes `entity_key` and re-materializes edges.

For advanced stability (future), add `symbol_fingerprint` derived from signature AST.

---

## 6. Indexing Pipeline (CLI + AOT/AST)

### 6.1 Full build

1. Read `.bunner/schema/version`
2. Parse all card files → `card` rows + `card_relation` rows (from frontmatter `relations[]`)
3. Parse code files via `oxc-parser` AST → `code_entity` rows + `code_relation` rows (imports, calls, extends, implements, injects, provides)
4. Parse JSDoc `@see {type}::key` annotations → `card_code_link` rows
5. Build/refresh FTS5 tables

### 6.2 Incremental build

- Use `file_state` to skip unchanged files
- If a card file changes: update `card` + `card_relation` rows from that file
- If a code file changes: update `code_entity` + `code_relation` + `card_code_link` rows from that file

### 6.3 Data flow

```
[.card.md frontmatter] ──parse──→ card + card_relation tables
[.card.md body]        ──parse──→ card.body column
[*.ts files AST]       ──parse──→ code_entity + code_relation tables
[*.ts JSDoc @see]      ──parse──→ card_code_link table
```

---

## 7. CLI Surface (Draft)

### 7.1 Commands

- `bunner kb init`
  - create `.bunner/` structure
  - add `.bunner/.cache/` to `.gitignore`
  - scaffold framework-shipped cards (`system::*`) if applicable

- `bunner kb index [--watch] [--full]`
  - build/refresh `.bunner/.cache/kb.sqlite`

- `bunner kb serve`
  - start MCP server (stdio / HTTP)
  - ensures index is ready (build if missing)

### 7.2 Write helpers

- `bunner kb card add|update|status`
  - create/modify `.card.md` (frontmatter + body)

- `bunner kb link add`
  - insert `@see {type}::key` annotation using AST (safe edit)

All write helpers use the **shared core logic** (same code as MCP write tools).

---

## 8. MCP Server (Embedded in CLI)

CLI and MCP share the **same core**. MCP is the primary interface for vibe-coding.

### 8.1 Read tools

- `search(query, filters)`
- `get_context(target)`
- `get_subgraph(center, hops, filters)`

All read tools query SQLite only.

### 8.2 Write tools (required, not deferred)

MCP write tools are **required** from v5.0. Framework authors use MCP exclusively.

Write tools must:

- modify SSOT files (cards / code annotations) via shared core logic
- trigger re-index after write
- never modify SQLite directly as SSOT

Examples:

- `card_create(type, key, summary, body)`
- `card_update_status(key, status)`
- `link_add(file_path, card_key)` — AST-safe JSDoc insertion

---

## 9. Performance Targets (Draft)

On a typical laptop (local SQLite):

- `get_context`: < 20ms
- `search` (FTS): < 30ms
- `get_subgraph` (hops=2): < 50ms
- incremental index for a single file change: < 200ms

---

## 10. Governance & History (Git-native)

v5 replaces DB-based audit logs with Git:

- approvals: PR review + commit history
- rollback: `git revert`
- history: `git log .bunner/cards/...`

If stronger governance is required later:

- add an optional append-only `.bunner/events.jsonl` (Git-tracked) as a structured audit stream

---

## 11. Invariants (Minimal set)

Hard rules (errors):

1. `card.key` is globally unique in repo
2. `card.type` must be a registered card type (in `bunner.config.ts`)
3. no duplicate card file defines the same key
4. every `**/*.ts` file has at least one `@see {type}::key` reference (excluding `**/*.d.ts` by default; exclusions via config only)
5. every code-referenced `{type}::key` must exist as a card
6. every `relations[].target` in frontmatter must exist as a card
7. `@see` type prefix must match the target card's `type` field

Soft rules (warnings):

1. `depends_on` cycles — policy TBD
2. references to `deprecated` cards — policy TBD

---

## 12. Resolved Decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Card status set | `draft \| accepted \| implementing \| implemented \| deprecated` |
| 2 | Relation storage | R1 (frontmatter) to start. Migrate to R2 if merge conflicts become frequent |
| 3 | AST engine | `oxc-parser` only. No TypeScript Compiler API |
| 4 | Code relation depth | Call-level included (imports, calls, extends, implements, injects, provides) |
| 5 | Link prefix | `{type}::key` (not fixed `card::` or `spec::`) |
| 6 | Policy/agent rules | Not stored in DB/cards. Out of scope for card model |
| 7 | `.tsx` support | Not applicable (backend framework) |
| 8 | In-code ignore tokens | Prohibited. Exclusions via config/CLI only |
| 9 | MCP write tools | Required from v5.0 (not deferred) |
| 10 | `parent` field | Removed. Graph/web structure only (typed edges) |
| 11 | Card↔code links | All card↔code links are `@see {type}::key` references (no `implements/tests` distinction) |
| 12 | CI enforcement | Mandatory (CI must reject missing/invalid links and missing targets) |

## 13. Open Decisions (remaining)

1. **Framework-shipped cards**: scaffold into user repo (A) vs read from package (B)?
2. **Card type registry**: static config only, or build-time (indexer execution-time) extensible?
3. **`relations[].type` allowlist policy**: fixed set only, or user-extensible via config allowlist?

---

## Appendix: Why this aligns with vibe-coding

- Agent reads become deterministic and fast (SQLite index)
- Human collaboration remains Git-native
- Complexity is concentrated in the indexer (single place), not in distributed DB constraints
- MCP write tools enable fully MCP-driven development (no CLI required)
- Card type system (`{type}::key`) supports framework rules, adapter rules, and user specs in a unified model
