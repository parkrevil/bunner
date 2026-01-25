# Coding Prompt Templates

## 0) 공통 Preflight 8줄 + Handshake

[README.md](README.md)의 Preflight 8줄 + Handshake를 먼저 출력하게 하세요.

---

## 1) 구현(Implementation) – 범위 내 최소 변경 + verify

사용 시 권장 Tool Set: `bunner.implement`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Goal:
- <기능/버그>를 <파일/패키지 범위> 내에서 구현한다.

Hard rules:
- 승인 토큰 없이 SSOT(docs/10..50), Public Facade(packages/*/index.ts), deps(package.json) 변경 금지.
- 추정 금지: 변경 전 관련 코드/사용처를 먼저 찾아서 근거를 제시.

Required reads (MUST):
- docs/40_ENGINEERING/STYLEGUIDE.md
- docs/40_ENGINEERING/TESTING.md
- docs/40_ENGINEERING/DEPENDENCIES.md
- docs/50_GOVERNANCE/DEAD_CODE_POLICY.md
- (해당 시) docs/20_ARCHITECTURE/ARCHITECTURE.md
- (해당 시) docs/30_SPEC/SPEC.md + 관련 *.spec.md

Codebase understanding gate (MUST, before edits):
- 변경 대상 파일/심볼(함수/클래스) 목록
- 엔트리포인트와 호출 경로 요약
- 사용처(References/grep) 최소 3개 근거

Execution:
- 작은 단위로 변경(1~3파일) → problems 확인 → 필요 시 bun run verify.

Deliver:
- 변경 파일 목록
- 핵심 로직 변화 3줄 요약
- 추가/수정 테스트(있는 경우)
- 다음 실행 커맨드: bun run verify
```

---

## 2) verify 실패 트리아지 – 범위 내 최소 수정

사용 시 권장 Tool Set: `bunner.triage`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Context:
- bun run verify 가 실패했다. (tsc/lint/test 중 어느 단계인지 포함)

Rules:
- fix는 승인된 범위 내에서만.
- scope가 늘어나거나 SSOT/파사드/deps 변경이 필요해지면: 승인 요청 후 STOP.

Required reads (MUST):
- docs/40_ENGINEERING/VERIFY.md
- docs/40_ENGINEERING/STYLEGUIDE.md
- docs/40_ENGINEERING/TESTING.md

Codebase understanding gate (MUST, before edits):
- 첫 실패 지점(로그) + 관련 파일/심볼
- 사용처/호출 경로 최소 1개 근거

Plan:
1) 실패 단계 1개만 먼저 통과시키는 최소 수정
2) 동일 단계 재실행
3) bun run verify 재실행

Output:
- Root cause 요약 3줄
- 적용한 최소 수정 요약
- 다음 실행 커맨드
```

---

## 3) 리팩토링(Refactor Gate) – 불변조건 + 단계별 verify

사용 시 권장 Tool Set: `bunner.refactor.gate`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Goal:
- <대상>을 리팩토링하되, 동작/공개 API/계약(spec)을 유지한다.

Rules:
- 시작 전에 불변조건(Invariants)을 먼저 명시한다.
- 1~3파일 단위로만 변경한다.
- 각 단계마다 bun run verify 로 게이트를 통과시킨다.
- 문서/spec 영향이 있으면 어떤 문서를 바꿔야 하는지 명시하고,
  의미 변경이면 승인 요청 후 STOP.

Required reads (MUST):
- docs/40_ENGINEERING/STYLEGUIDE.md
- docs/40_ENGINEERING/TESTING.md
- docs/50_GOVERNANCE/DEAD_CODE_POLICY.md
- (해당 시) docs/30_SPEC/SPEC.md + 관련 *.spec.md

Codebase understanding gate (MUST, before edits):
- Invariants(유지 조건) 목록
- 변경 대상/사용처 요약

Deliver:
- Invariants 목록
- 단계별 변경 파일 목록
- 단계별 verify 결과 요약
```
