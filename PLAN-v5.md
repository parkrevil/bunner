# Card-centric Knowledge Base Design (Git-first + File SSOT + SQLite Index)

> **Scope**: bunner MCP architecture optimized for vibe-coding agents
> **Status**: Draft v5.3 — 2026-02-11
> **Core idea**: **Git is the source of truth** (cards are files with frontmatter metadata + body spec). **SQLite is a disposable local index (gitignored, always rebuildable)** for ultra-fast agent traversal.
> **Where it lives**: bunner **CLI package** — CLI and MCP share the same core logic.

**Out of scope**: `docs/` (do not reference it; it will be deleted)

---

## 1. Problem Statement

During vibe-coding, an agent must be able to answer quickly:

- "What requirement(card) does this code implement?"
- "What code implements this card?"
- "What other cards depend on this?"
- "What code is adjacent/impacted?"

And the answer must be:

- **Fast** (sub-100ms interactive)
- **Branch-safe** (Git branches naturally isolate)
- **Merge-safe** (Git merge resolves conflicts)
- **Low-ops** (no always-on shared DB requirement)

---

## 2. Design Goals

1. **Git-first SSOT**: Card files (frontmatter + body) are Git-tracked, human-reviewable, mergeable.
2. **SQLite index**: Disposable local cache (gitignored). Provides high-performance traversal/search. Always rebuildable.
3. **CLI + MCP share core**: Both interfaces invoke the same core logic for reads and writes. Framework authors may use MCP exclusively; end-users may use CLI.
4. **MCP embedded**: MCP server is started via `bunner mcp` (single command). MCP write tools are **required** (not deferred).
5. **AOT/AST (oxc-parser only)**: Reuse existing CLI `oxc-parser` pipeline. No TypeScript Compiler API dependency.
6. **Call-level code relations**: Code↔code relations include imports, calls, extends, implements, DI inject/provide — all statically extractable via AST.
7. **Dual audience**: Must serve both the framework author (building bunner itself via vibe-coding/MCP) and framework users (who get richer features including framework rules via MCP).
8. **No "snapshot export/import" as a workflow**: the SSOT is the files themselves.

---

## 3. High-Level Architecture

### 3.1 Source-of-truth layers

- **SSOT (Git-tracked)**: `.bunner/cards/**/*.card.md` (frontmatter=metadata, body=spec) + **optional** in-code card links (JSDoc `@see {type}::key`)
- **Derived local index (gitignored)**: `.bunner/.cache/index.sqlite`

```
repo/
  .bunner/
    cards/                 # SSOT: card files (frontmatter + body)
    schema/                # SSOT: format/versioning metadata
    .cache/                # gitignored
      index.sqlite         # Derived index for fast queries
  bunner.jsonc             # Config: source dir, entry, card types, exclusions
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
|------|---------|
| `spec` | Feature/requirement specification |
| `system` | Framework-level rule (shipped with bunner) |
| `adapter` | Adapter-specific rule (shipped with adapter packages) |

Additional types can be registered in `bunner.jsonc`:

```jsonc
{
  "sourceDir": "./src",
  "entry": "./src/main.ts",
  "cardTypes": ["spec", "system", "adapter"]
}
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

**Body** contains **spec content only**. No AC checklists, no style guides, no tutorials. Completion is determined by user-directed `status` transitions.

### 4.4 Relationship model (graph/web, no tree)

- **No `parent` field**. No forced tree hierarchy.
- All card↔card relationships are **typed edges** stored in frontmatter `relations[]`.
- `relations[].type` is a fixed set of edge kinds:

| Type | Meaning |
|------|---------|
| `depends_on` | Prerequisite / blocking |
| `references` | Weak reference / background |
| `related` | Associated (non-directional) |
| `extends` | Refinement / elaboration |
| `conflicts` | Contradicts / clashes |

- SSOT stores **outgoing edges only**. Reverse edges are auto-generated by the indexer in SQLite.
- Start with R1 (frontmatter). Migrate to R2 (separate files) if merge conflicts become frequent.

### 4.5 Card↔Code links (card-centric verification)

`@see {type}::key` is an **optional connection mechanism**. Code uses `@see` to declare that it implements a specific card.

Not every code file needs a card link. Types, interfaces, constants, and utility code may exist without `@see`. Verification is **card-centric**, not code-centric.

#### Syntax

```ts
/**
 * @see spec::auth/login
 */
export function handleOAuthCallback() {}
```

Multiple links:

```ts
/**
 * @see spec::auth/login
 * @see spec::auth/session
 */
```

Framework-shipped cards use their type prefix:

```ts
/**
 * @see system::di/injection
 * @see adapter::express/middleware
 */
```

#### Card-centric verification rules

Verification checks whether **confirmed cards have implementation code linked**, not whether all code has card links.

| Card status | No @see references | Action |
|-------------|-------------------|--------|
| `draft` | — | no check |
| `accepted` | warning | "confirmed card, no implementation code linked" |
| `implementing` | warning | "card in progress, no code linked" |
| `implemented` | **error** | "marked implemented but no code linked" |
| `deprecated` | — | no check |

#### Verification layers

Card-centric verification operates at two layers:

**1. Verification command warnings**

When the verification command (`bunner mcp verify`, etc.) is executed, it warns about confirmed cards (`accepted` / `implementing` / `implemented`) that have no `@see` code links.

**2. Agent instruction hardcoding (out of document scope)**

Hardcode the following rule into agent instruction files (`.github/copilot-instructions.md`, `AGENTS.md`, `.cursor/rules/`, etc.):

> When writing or modifying implementation code, always insert `@see {type}::key` JSDoc comments if the code relates to a card.

This rule is outside the scope of the card system document, but is stated at the design stage because card-centric verification requires agents to consistently insert `@see` links. Actual instruction file modifications will be done during implementation.

#### Validity rules (always enforced)

- Every `@see {type}::key` in code MUST reference an existing card
- `@see` type prefix MUST match the target card's `type` field
- Invalid `@see` references are **errors**

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
- `impact_analysis`
- `trace_chain`

It must be rebuildable from:

- `.bunner/cards/**/*.card.md`
- code files under configured source roots (from `bunner.jsonc`)

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
  fingerprint   TEXT,              -- hash of (symbol_name + kind + signature) for move tracking
  content_hash  TEXT NOT NULL,
  updated_at    TEXT NOT NULL
)

-- Card↔Card relations (parsed from frontmatter relations[])
-- Indexer auto-generates reverse edges (is_reverse = true) for bidirectional traversal
card_relation(
  id            INTEGER PRIMARY KEY,
  type          TEXT NOT NULL,     -- depends_on|references|related|extends|conflicts
  src_card_key  TEXT NOT NULL REFERENCES card(key),
  dst_card_key  TEXT NOT NULL REFERENCES card(key),
  is_reverse    BOOLEAN NOT NULL DEFAULT false,
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

-- FTS5 virtual tables for full-text search (trigram tokenizer for CJK support)
CREATE VIRTUAL TABLE card_fts USING fts5(key, summary, body, tokenize='trigram');
CREATE VIRTUAL TABLE code_fts USING fts5(entity_key, symbol_name, tokenize='trigram');
```

### 5.3 Identity strategy

- Cards: identity is `card.key` (e.g. `spec::auth/login`). Key is defined in frontmatter and is immutable by policy. Rename is supported via `card_rename` tool (updates all references).
- Code: identity is `entity_key` derived from AST:
  - module: `module:{relativePath}`
  - symbol: `symbol:{relativePath}#{symbolName}`

**Fingerprint for move tracking**:
- `fingerprint` = hash of (symbol_name + kind + signature)
- When a file moves, the indexer matches old entities to new entities by fingerprint
- Match found → update `entity_key`, preserve `code_relation` edges
- No match → delete old, create new

---

## 6. Indexing Pipeline (CLI + AOT/AST)

### 6.1 Full build

1. Read `.bunner/schema/version`
2. Parse all card files → `card` rows + `card_relation` rows (from frontmatter `relations[]`)
3. Auto-generate reverse `card_relation` rows (`is_reverse = true`)
4. Parse code files via `oxc-parser` AST → `code_entity` rows (with fingerprint) + `code_relation` rows (imports, calls, extends, implements)
5. Parse JSDoc `@see {type}::key` annotations → `card_code_link` rows
6. Build/refresh FTS5 tables (trigram)

### 6.2 Incremental build

- Use `file_state` to skip unchanged files
- If a card file changes: update `card` + `card_relation` rows (including reverse edges) from that file
- If a code file changes: update `code_entity` + `code_relation` + `card_code_link` rows from that file
- File move detection: compare fingerprints of deleted entities with new entities to preserve relations

### 6.3 Data flow

```
[.card.md frontmatter] ──parse──→ card + card_relation tables (+ reverse edges)
[.card.md body]        ──parse──→ card.body column
[*.ts files AST]       ──parse──→ code_entity (with fingerprint) + code_relation tables
[*.ts JSDoc @see]      ──parse──→ card_code_link table
```

### 6.4 Code relation extractor (plugin structure)

The code relation extraction pipeline is designed for extensibility:

```typescript
interface CodeRelationExtractor {
  name: string;
  extract(ast: AST, filePath: string): CodeRelation[];
}
```

**Currently implemented:** `imports`, `calls`, `extends`, `implements` (pure AST extractable)

**Reserved for future:** `injects`, `provides` (framework-specific, to be added with system/adapter card types)

---

## 7. CLI Surface (Draft)

### 7.1 Commands

- `bunner mcp rebuild [--full]`
  - build/refresh `.bunner/.cache/index.sqlite` (manual rebuild)

- `bunner mcp`
  - start MCP server (stdio / HTTP)
  - auto-ensure required repo structure/config on startup:
    - create `.bunner/` structure if missing
    - ensure `.bunner/.cache/` is gitignored
    - ensure `bunner.jsonc` exists and has minimum required fields
  - ensures index is ready (build if missing)
  - always-on index watch: when cards/code change, automatically re-index

### 7.2 Write helpers

- `bunner mcp card add|update|delete|rename|status`
  - create/modify/delete/rename `.card.md` (frontmatter + body)
  - `rename` updates all `@see` references + `relations[].target` across codebase

- `bunner mcp link add|remove`
  - insert/remove `@see {type}::key` annotation using AST (safe edit)

- `bunner mcp relation add|remove`
  - add/remove `relations[]` entries in card frontmatter

All write helpers use the **shared core logic** (same code as MCP write tools).

---

## 8. MCP Server (Embedded in CLI)

CLI and MCP share the **same core**. MCP is the primary interface for vibe-coding.

### 8.1 Read tools

- `search(query, filters)` — full-text search across cards and code
- `get_context(target)` — card or code entity with linked entities
- `get_subgraph(center, hops, filters)` — N-hop graph traversal (visited set cycle prevention)
- `impact_analysis(card_key)` — cards + code affected by a card change (reverse dependency traversal)
- `trace_chain(from_key, to_key)` — shortest relation path between two entities
- `coverage_report(card_key)` — card's linked code status
- `list_unlinked(status_filter)` — cards with no @see code references (filterable by status)
- `list_cards(filters)` — card listing by status, type, tags
- `get_relations(card_key, direction)` — card's relations (outgoing / incoming / both)

All read tools query SQLite only.

### 8.2 Write tools (required, not deferred)

MCP write tools are **required**. Framework authors use MCP exclusively.

Write tools must:

- modify SSOT files (cards / code annotations) via shared core logic
- trigger re-index after write
- never modify SQLite directly as SSOT

Tools:

- `card_create(type, key, summary, body)` — create card file
- `card_update(key, fields)` — update card frontmatter/body
- `card_delete(key)` — delete card file (validates no dangling @see references)
- `card_rename(old_key, new_key)` — rename key across all @see + relations
- `card_update_status(key, status)` — transition card status
- `link_add(file_path, card_key)` — AST-safe JSDoc @see insertion
- `link_remove(file_path, card_key)` — AST-safe JSDoc @see removal
- `relation_add(src_key, dst_key, type)` — add relation to card frontmatter
- `relation_remove(src_key, dst_key, type)` — remove relation from card frontmatter

---

## 9. Performance Targets (Draft)

Benchmark baseline: **500 cards + 2,000 code files + 10,000 code entities**

On a typical laptop (local SQLite):

| Operation | Target |
|-----------|--------|
| `get_context` | < 20ms |
| `search` (FTS trigram) | < 30ms |
| `get_subgraph` (hops=2) | < 50ms |
| `impact_analysis` (depth=3) | < 100ms |
| incremental index (1 file) | < 200ms |
| full rebuild | < 10s |

---

## 10. Governance & History (Git-native)

All governance is handled by Git:

- approvals: PR review + commit history
- rollback: `git revert`
- history: `git log .bunner/cards/...`

If stronger governance is required later:

- add an optional append-only `.bunner/events.jsonl` (Git-tracked) as a structured audit stream

---

## 11. Invariants (Minimal set)

Hard rules (errors):

1. `card.key` is globally unique in repo
2. `card.type` must be a registered card type (in `bunner.jsonc`)
3. no duplicate card file defines the same key
4. every code-referenced `{type}::key` must exist as a card
5. every `relations[].target` in frontmatter must exist as a card
6. `@see` type prefix must match the target card's `type` field
7. card with status `implemented` must have at least one `@see` code reference

Soft rules (warnings):

1. card with status `accepted` or `implementing` has no `@see` code references
2. `depends_on` cycles (traversal uses visited set to prevent infinite loops)
3. references to `deprecated` cards

---

## 12. Resolved Decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Card status set | `draft \| accepted \| implementing \| implemented \| deprecated` |
| 2 | Relation storage | R1 (frontmatter, outgoing only) to start. Reverse edges auto-generated by indexer. Migrate to R2 if merge conflicts become frequent |
| 3 | AST engine | `oxc-parser` only. No TypeScript Compiler API |
| 4 | Code relation depth | Call-level included (imports, calls, extends, implements). injects/provides reserved for future |
| 5 | Link prefix | `{type}::key` (not fixed `card::` or `spec::`) |
| 6 | Policy/agent rules | Not stored in cards. Out of scope for card model |
| 7 | `.tsx` support | Not applicable (backend framework) |
| 8 | In-code ignore tokens | Not applicable (`@see` is optional; no code-level enforcement to bypass) |
| 9 | MCP write tools | Required (not deferred). Full CRUD for cards, links, relations |
| 10 | `parent` field | Removed. Graph/web structure only (typed edges) |
| 11 | Card↔code links | `@see {type}::key` is optional. Verification is card-centric (not code-centric) |
| 12 | CI enforcement | Mandatory for: invalid @see targets, implemented cards without code links |
| 13 | @see enforcement | Optional. Card-centric verification, not code-centric |
| 14 | Reverse relations | Auto-generated by indexer (`is_reverse` flag). SSOT stores outgoing only |
| 15 | Code identity | Path-based `entity_key` + `fingerprint` (symbol+kind+signature hash) for move tracking |
| 16 | Status transitions | User-directed. No automatic AC checking. Agent acts on user instruction |
| 17 | FTS tokenizer | trigram (for CJK/Unicode support) |
| 18 | Cycle handling | Visited set in traversal tools. `depends_on` cycles are CI warnings (not errors) |
| 19 | Code relation extractors | Plugin interface ready. Only pure-AST extractors implemented now |
| 20 | Config format | `bunner.jsonc` (JSONC). Shared with framework config |
| 21 | Package structure | CLI package (`packages/cli/`). MCP commands as `bunner mcp` subcommand group |
| 22 | Framework-shipped cards | Deferred. `bunner mcp` auto-creates required empty structure on first run. Content TBD |
| 23 | Card type registry | Static config only (in `bunner.jsonc`) |
| 24 | `relations[].type` set | Fixed 5 types: depends_on, references, related, extends, conflicts |
| 25 | Verification command warnings | Verification command warns about confirmed cards with no code links |
| 26 | Agent @see insertion rule | Hardcode `@see` insertion rule in agent instruction files (applied during implementation) |

## 13. Future Discussion (out of current scope)

Items to discuss in later phases. Recorded here for continuity.

### Architecture / Design

1. **Framework user data accumulation**: How to collect and structure data for framework end-users? What data does the MCP expose to users building apps with bunner?
2. **CLI manifest output format**: Should manifests generated by the CLI compiler be stored in SQLite or exported as JSON? (Reference: `docs/30_SPEC/compiler/manifest.spec.md`)
3. **PLAN-v4 content review**: Are there concepts or mechanisms from PLAN-v4 worth adopting into this architecture?
4. **Framework-shipped cards expansion**: When to scaffold `system::*` / `adapter::*` cards into user repos? Scaffold (A) vs read from package (B)?
5. **Card type registry expansion**: Allow build-time extensible card types beyond static config?
6. **`relations[].type` expansion**: Allow user-defined relation types via config allowlist?

### Implementation Details

7. **`.bunner/schema/version` format**: Version management and migration strategy for card format changes
8. **YAML frontmatter parser**: Bun-compatible library selection for card parsing
9. **oxc-parser JSDoc @see extraction**: Integration with existing CLI AST pipeline for `@see {type}::key` parsing
10. **MCP transport protocol**: stdio vs HTTP selection criteria and configuration
11. **Watch mode implementation**: File watcher strategy (reference: existing `node:fs` watcher in `packages/cli/src/watcher/`)
12. **`card_rename` transaction safety**: Atomicity guarantees when renaming across many files

---

## Appendix: Why this aligns with vibe-coding

- Agent reads become deterministic and fast (SQLite index)
- Human collaboration remains Git-native
- Complexity is concentrated in the indexer (single place), not in distributed constraints
- MCP write tools enable fully MCP-driven development (no CLI required)
- Card type system (`{type}::key`) supports framework rules, adapter rules, and user specs in a unified model
- Card-centric verification allows exploratory coding (code first, link later) while ensuring confirmed specs have implementations
