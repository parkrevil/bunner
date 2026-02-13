# Bun-first Policy

## Runtime Priority

1. **Bun built-in / Bun runtime API** — highest
2. Node.js standard API — only when Bun lacks support
3. npm packages — only when Bun and Node cannot solve it
4. Custom implementation — last resort

## Scope

Applies to **every** case where Node.js API, npm package, or custom implementation is considered.
No exception for size or perceived importance. A one-liner utility still requires Bun-alternative verification.

## Verification Flow

1. About to use Node.js / npm / custom implementation → **STOP.**
2. Search Bun official documentation for an equivalent Bun API. Follow `.ai/rules/search-policy.md` lookup priority.
3. Bun alternative **exists** → use it.
4. Bun alternative **confirmed absent** (with search evidence) → present the evidence + proposed alternative → obtain `ㅇㅇ`.

**Selecting Node/npm without search verification is a policy violation.**

## Node.js Dependency Minimization

- Do not replicate existing Node.js patterns in new code if a Bun alternative exists.
- When encountering Node.js API usage in existing code, propose migration to Bun equivalent (approval required).
