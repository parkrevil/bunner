
# Firebat AGENTS (Rules)

목표: 간단/명료/직관. 읽으면 바로 행동이 결정되어야 한다.

----------------

## 1) 코드 형태

- 기본은 function.
- class는 “리소스 수명/상태”가 있을 때만 허용한다.
  - 예: sqlite repository, tsgo runner, ast-grep rule cache, oxlint runner

----------------

## 2) 아키텍처/디렉토리

- 고정 패턴: Hexagonal(Ports/Adapters) + UseCase + Provider/Repository.
- 분리 기준:
  - core: 타입/계약/에러
  - application: 유스케이스(Scan/Trace) + detector registry
  - ports: 교체 가능한 경계
  - infrastructure: oxc/ast-grep/tsgo/oxlint/sqlite 구현
  - adapters: cli, mcp

----------------

## 3) 파일/네이밍

- 작은 범위(소수 파일): `types.ts`, `interfaces.ts`, `enums.ts`, `constants.ts` 허용.
- 커지면 단일 책임 파일로 분해:
  - `kebab-case.type.ts`, `kebab-case.interface.ts`, `kebab-case.enum.ts`, `kebab-case.constant.ts`
- 전환 기준: “파일이 역할 2개 이상” 또는 “파일 길이가 과도”하면 분해한다.

----------------

## 4) import/export

- `export *` 금지.
- import는 파일 상단 1블록.
- export는 파일 하단 1블록(중간 export 금지).

----------------

## 5) MCP 도구 사용 정책 (Proactive-by-default)

- 기본: MCP는 적극 사용한다.
- read-first: 근거 수집은 자동.
- write-last: 파일 수정/생성/삭제는 승인 토큰 없이는 금지.

도구 우선순위

- filesystem: 레포 사실 확인은 무조건 이걸 우선한다.
- context7: 언어/패키지/플랫폼/버전/옵션 같은 기술 사실은 기본 조회한다.
- sequential-thinking: 항상 단계화(계획/가설/검증/리스크).
- memory: 항상 검색/조회하고, 필요한 사실은 축적한다.
  - 비밀/키/개인정보 저장 금지.

중단/승인 게이트

- 불확실하면 STOP 후 질문.
- 승인 범위 밖이면 STOP.
- Write 필요 시 (변경 대상/리스크/대안) 제시 후 승인 요청.
