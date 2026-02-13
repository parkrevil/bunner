# Workflow Rules

## Spec-Check Loop

1. Before starting, read relevant SPEC/PLAN documents.
2. Extract a requirements checklist.
3. After completion, re-compare against the checklist.
4. Report any missing items.

## Impact-First

Before modifying code, **assess impact scope first:**

1. Search for all usages/references of the target symbol.
2. Search for related imports/dependencies.
3. Include impact scope in approval Targets.

## Test-First Flow

1. Determine the scope of changes.
2. **Write ALL tests first** (unit + integration).
3. Execute tests → confirm RED → report to user.
4. `ㅇㅇ` approval → begin implementation.
5. Implementation complete → confirm GREEN.

## Incremental Test Run

- After each file modification, **immediately run related tests.**
- On failure → do not proceed to the next file. Fix first.
- After all files are modified → run full test suite.

## Commit Checkpoint

- Propose a commit at each logical unit (one feature, one bug fix).
- Commit message follows conventional commits format.
- User approves → execute. User declines → skip.
