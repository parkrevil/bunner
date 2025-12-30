# QUICK REFERENCE

모든 에이전트 규칙 문서의 1페이지 요약입니다.

---

## 즉시 중단 조건

| 카테고리 | 조건                | SSOT       |
| -------- | ------------------- | ---------- |
| 보안     | 민감정보 반입       | POLICY     |
| 보안     | 라이선스 위반       | POLICY     |
| AOT      | `reflect-metadata`  | POLICY     |
| AOT      | 런타임 리플렉션     | POLICY     |
| 경계     | deep import         | POLICY     |
| 경계     | 순환 의존           | POLICY     |
| 계약     | Facade 무단 변경    | POLICY     |
| 폭주     | 3회+ 동일 구간 수정 | SAFEGUARDS |

---

## 승인 필요 상황

| 상황            | 행동             | SSOT       |
| --------------- | ---------------- | ---------- |
| 범위 밖 변경    | 승인 요청        | GOVERNANCE |
| SSOT 문서 변경  | 승인 요청        | GOVERNANCE |
| Public API 변경 | export 목록 제시 | AGENTS     |
| 아키텍처 변경   | 승인 요청        | GOVERNANCE |

---

## 핵심 코딩 규칙

| 규칙                 | 위반 예              |
| -------------------- | -------------------- |
| 파일명 `kebab-case`  | `UserService.ts` ❌  |
| 한 글자 변수 금지    | `p`, `v` ❌          |
| 축약어 금지          | `ctx`, `req` ❌      |
| 인라인 타입 금지     | `{ a: number }` ❌   |
| `any`/`unknown` 금지 | 정확한 타입 사용     |
| 반환 타입 명시       | `function(): string` |
| Early return 블록    | `if(x) { return; }`  |

---

## 패키지 의존 규칙

```text
common ← logger ← core ← http-adapter
                      ↖ scalar

cli → common (only)
examples → all
```

❌ 금지: 역방향 의존, CLI→런타임 패키지

---

## 워크플로우

```bash
bun run verify      # 전체 (tsc + lint + test)
bun run tsc         # 타입체크
bun run lint        # 린트
bun test            # 테스트
```

---

## 문서 맵

| 상황          | 문서               |
| ------------- | ------------------ |
| 불변조건      | SPEC               |
| 에이전트 규칙 | AGENTS             |
| 즉시 중단     | POLICY, SAFEGUARDS |
| 승인/권한     | GOVERNANCE         |
| 패키지 경계   | ARCHITECTURE       |
| 의존성 선언   | DEPENDENCIES       |
| 파일 배치     | STRUCTURE          |
| 코딩 스타일   | STYLEGUIDE         |
| 테스트        | TESTING            |
| CLI/AOT       | TOOLING            |
| 데드 코드     | DEAD_CODE_POLICY   |
| 커밋          | COMMITS            |
