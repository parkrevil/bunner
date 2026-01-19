---
description: 단일 Run Plan 템플릿 (에이전트 실행 입력)
---

# Run Plan

> 이 문서는 에이전트가 작업을 시작하기 전에 반드시 채워야 하는 **실행 입력 템플릿**이다.
>
> - 본 문서는 **입력 양식**만을 정의한다.
> - 모든 규칙·판정·승인·중단의 정본은 아래 문서를 따른다.
>   - 정본(문서 지도): [docs/00_INDEX.md](../../docs/00_INDEX.md)
>   - 권한/행동 제한: [AGENTS.md](../../AGENTS.md)
>   - 프로세스: [workflow.md](workflow.md)

## 작성 가이드

- 저장 위치: `plans/<yymmdd>_<seq>_<plan-name>.md`
- 상태(status): [workflow.md](workflow.md)의 상태 머신을 따른다.
- 승인/중단/전이 규칙: [workflow.md](workflow.md)를 따른다.

### 필수 헤더 (Plan 파일)

Plan 파일은 frontmatter에 최소한 아래 필드를 포함해야 한다.

```yaml
---
status: draft
---
```

> `status` 값은 [workflow.md](workflow.md)의 상태 머신을 따른다.

---

## 0) Persona / Handshake (필수)

- Persona:
  - `@Architect` | `@Implementer` | `@Reviewer`

- Handshake (AGENTS.md 형식 그대로):
  - "<여기에 AGENTS.md의 Handshake 문구를 그대로 붙여넣는다>"

## 0) 원문(사용자 입력)

- 원문:
  - "<사용자가 최초로 입력한 문장 그대로>"

- 에이전트 해석(검증 가능하게):
  - 무엇을 변경하는가
  - 성공 조건은 무엇인가
  - 명시적 제약은 무엇인가

- SSOT 충돌 여부:
  - [ ] 없음
  - [ ] 있음 → [workflow.md](workflow.md)의 중단/논의 절차로 이관

---

## 1) 기대효과

- <기대효과 1>
- <기대효과 N>

---

## 2) 범위(Scope) / 비범위(Non-Goals)

### Scope

- 변경 대상과 이유:
  - path/to/file: <이유>

- 변경 유형:
  - [ ] 생성
  - [ ] 수정
  - [ ] 삭제
  - [ ] 이동/병합

- 영향 범위 선언(사실 기술):
  - 영향 가능 패키지/모듈: <나열>
  - Public Facade 변경: 없음 | 있음
  - 패키지 의존 변경: 없음 | 있음

### Non-Goals

- <이번 작업에서 의도적으로 하지 않는 것>

---

## 3) SSOT 확인 기록

> 아래 항목은 **판정이 아니라 확인 기록**이다.  
> 각 항목에 대해 참조한 문서/섹션만 기재한다.

- SPEC: <문서/섹션>
- ARCHITECTURE: <문서/섹션>
- STRUCTURE: <문서/섹션>
- STYLEGUIDE: <문서/섹션>

---

## 4) 작업 설계(선택지/결정)

- 선택지:
  - 요약: <...>
  - 리스크: <...>

- 최종 결정:
  - <선택>
  - 근거(참조 문서): <...>

---

## 5) 실행 계획

> 파일 단위로 작성한다.

### Step 1) <단계명>

- 작업 내용:
  - <...>

- 중간 검증:
  - <검증 방법>

- 변경 파일:
  - path/to/file
    - 목적: <...>
    - 변경 내용: <...>
    - 주의 사항: <...>

### Step 2) <단계명>

---

## 6) 검증 / 완료 조건

- [ ] `bun run verify` 통과
- [ ] [workflow.md](workflow.md) 절차 준수

---

## 7) 리스크 / 롤백

- 리스크:
  - <...>

- 롤백:
  - <방법>

- verify 실패:
  - [docs/50_GOVERNANCE/SAFEGUARDS.md](../../docs/50_GOVERNANCE/SAFEGUARDS.md) 절차를 따른다.

---

## Plan Changes (append-only)

> `in-progress` 상태에서만 기록한다.

- 변경 요약:
  - <...>
- 승인 증거:
  - `<승인 토큰>`
- 영향 범위:
  - <...>
