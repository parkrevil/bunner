# Spec Prompt Templates

## 0) 공통 Preflight 8줄
[README.md](README.md)의 Preflight 8줄을 먼저 출력하게 하세요.

---

## 1) spec 초안 작성 (TEMPLATE 강제)

사용 시 권장 Tool Set: `bunner.spec`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Goal:
- docs/30_SPEC/<feature>.spec.md 초안을 작성한다.

Must:
- docs/30_SPEC/TEMPLATE.md의 구조를 엄격히 따른다.
- 구현 지시/튜토리얼을 쓰지 말고, 계약(Contract)과 관측 가능한 의미(Observable Semantics)만 쓴다.
- 위반 조건(Violation Conditions)을 테스트 가능한 형태로 작성한다.

Output:
- In-Scope / Out-of-Scope
- Contract (불릿)
- Violation Conditions (불릿)
- 다른 spec/architecture와 충돌 가능성(있으면 bunner.align로 라우팅)
```

---

## 2) spec 정합/충돌 정리 (align 라우팅)

사용 시 권장 Tool Set: `bunner.align`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Task:
- docs/30_SPEC/<a>.spec.md 와 <b>.spec.md (또는 docs/20_ARCHITECTURE/*) 사이의 충돌/중복/모순을 찾고 정리한다.

Rules:
- 충돌은 "boolean 문장"으로 재기술해서 판정 가능하게 만든다.
- 해결책은 "최소 수정" 1~3안만 제시한다.
- 의미(SSOT) 변경이 필요하면 승인 요청 포맷으로 요청 후 STOP.

Output:
1) Conflicts list
2) Minimal edit options (1~3)
3) Approval needed? yes/no
```

---

## 3) spec → 테스트/verify 매핑

사용 시 권장 Tool Set: `bunner.spec`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Goal:
- <spec 경로>의 Violation Conditions가 "bun run verify" 체계에서 검증 가능하도록 매핑을 만든다.

Rules:
- tests는 기본적으로 deterministic/hermetic해야 한다 (docs/40_ENGINEERING/TESTING.md).
- verify는 tsc + lint + test (docs/40_ENGINEERING/VERIFY.md).

Output:
- 각 Violation Condition → 추천 테스트 유형(unit/integration/e2e) + 관측 포인트
- 현재 코드베이스에서 필요한 seam/표면(관측 가능 출력) 제안 (구현 지시 아님)
```
