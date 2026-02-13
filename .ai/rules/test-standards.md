# Test Standards

## Test-First Rule (absolute)

### Every code change requires tests first.

- **New code:** Write ALL tests → confirm RED → implement → confirm GREEN.
- **Existing code modification:** Write/modify tests reflecting the change intent → confirm RED → modify code → confirm GREEN.
- **Bug fix:** Write a test reproducing the bug → confirm RED → fix → confirm GREEN.
- Writing implementation before tests is a **policy violation**.
- Mixing test-writing and implementation phases is a **policy violation**.

### RED Checkpoint

1. After writing tests, **execute them** and confirm failure (RED).
2. Report RED results to the user using the `[RED Checkpoint]` block defined in `workflow.md`.
3. Implementation phase requires `ㅇㅇ` approval to proceed.

**The `[RED Checkpoint]` block is a hard gate. Without it, writing implementation code is prohibited.**

## Unit Test Principles (absolute, no exceptions)

### 1. Isolation

- Each test is independent. No test may depend on another.
- Execution order must not affect results.
- No shared mutable state between tests.
- Use `beforeEach`/`afterEach` to reset state.

### 2. SUT Boundary

- **All** calls outside the SUT boundary must be mocked/stubbed.
- Internal vs external is irrelevant — if it crosses the SUT boundary, mock it.
- DB, filesystem, network, timers, side effects → always mock.

### 3. Spy Verification

- When the SUT calls external dependencies, verify with spies: call count, arguments, order.
- "Correct output" is insufficient — "called correctly" must also be verified.

### 4. One Concept Per Test

- One `it` block tests one behavior/scenario.
- Multiple unrelated assertions in a single test → violation.

### 5. Boundary & Error Cases

- Happy path only is insufficient.
- Boundary values, empty input, null/undefined, error paths → mandatory.

### 6. Type Safety

- `any` in test code → prohibited.
- Mocks/stubs must use correct types.

### 7. Async Discipline

- Async tests must use `async/await`.
- Returning a Promise without `await` → violation.

### 8. Deterministic

- Results must be identical regardless of environment, time, or execution order.
- Random data, current time dependency → mock to fixed values.

### 9. Clean Teardown

- Resources created by tests (files, DB, temp dirs) must be cleaned up.
- State leaking to the next test → violation.

## Coverage Scope

**"Integration > Unit" refers to writing order priority, NOT a license to skip unit tests.**

Every module/function is a unit test candidate (`*.spec.ts`).
If no unit target exists, present justification to the user and obtain `ㅇㅇ` approval.

## Style

- **BDD:** `describe` / `it` (describe behavior, "should ~")
- **AAA:** Arrange → Act → Assert

## Runner

`bun:test`

## File Locations

| Type | Location | Extension |
| --- | --- | --- |
| Unit | Next to source file (colocation) | `*.spec.ts` |
| Integration | `packages/*/test/` | `*.test.ts` |

## Utilities

`test/stubs/`, `test/fixtures/`, `test/helpers/`
