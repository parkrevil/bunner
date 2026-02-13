# Search & Verification Policy

## Lookup Priority (mandatory order)

When external information is needed, follow this order strictly:

### 1. Official documentation (latest, authoritative)

- Access official doc URLs directly (bun.sh/docs, nodejs.org/api, orm docs, etc.)
- If URL is unknown → proceed to priority 2.

### 2. Web search (latest, broad)

- Use web search tools/MCP if available.
- Or access search result pages directly.

### 3. Doc-query MCP — e.g. context7 (supplementary, cross-check)

- **context7 may contain outdated data. It is not authoritative.**
- Use as cross-check for priorities 1–2, or fallback when 1–2 yield nothing.
- **Never base a decision on context7 results alone.**

### 4. Codebase search (internal patterns)

- Text/regex search, semantic search, file read.
- For confirming existing patterns and usage within the repo.

## Dual Source Verification

Any decision based on external information requires **cross-check from ≥ 2 sources.**

- Official docs + doc-query MCP
- Official docs + web search
- Single-source decisions are a policy violation.

## Mandatory Lookup Situations (no exceptions)

1. Runtime choice (Bun vs Node)
2. Package decisions (add/remove/version/API/compat)
3. Public API changes
4. Config file changes
5. Version/compatibility decisions
6. Bun/Node API behavior, options, or defaults
7. Native library/module selection — Bun alternative check

## On Failure

Lookup failure → report "tool name + information needed" to user and wait.
**Never substitute with inference.**
