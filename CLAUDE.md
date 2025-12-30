# Claude/Cursor/Windsurf AI Agent Instructions

이 문서는 Claude 기반 에이전트(Cursor, Windsurf, Cline 등)를 위한 규칙 요약입니다.

## 필독 문서 순서

1. **[SPEC.md](SPEC.md)** - 최상위 불변조건
2. **[AGENTS.md](AGENTS.md)** - 에이전트 집행 규칙
3. **[ARCHITECTURE.md](ARCHITECTURE.md)** - 패키지 경계/의존
4. **[STYLEGUIDE.md](STYLEGUIDE.md)** - 코딩 스타일

## 즉시 중단 조건 (Hard Stops)

아래 조건 중 하나라도 해당하면 **즉시 중단**:

| 카테고리 | 조건                                   |
| -------- | -------------------------------------- |
| **보안** | 민감정보(키/토큰/비밀번호) 코드에 포함 |
| **AOT**  | `reflect-metadata` 사용                |
| **AOT**  | 런타임 리플렉션/스캔 도입              |
| **AOT**  | 비결정적 산출물(시간/랜덤 의존)        |
| **경계** | 다른 패키지 `src/**` 직접 import       |
| **경계** | 순환 의존성 도입                       |
| **계약** | Public Facade 무단 변경                |
| **계약** | Silent breaking change                 |
| **폭주** | 동일 구간 3회 이상 수정 반복           |

## 작업 전 체크리스트

- [ ] 작업 범위가 명확한가?
- [ ] 패키지 경계를 넘는 변경인가? → 승인 요청
- [ ] Public API 변경인가? → 승인 요청
- [ ] 테스트가 필요한 변경인가?

## 승인 필요 상황

| 상황                  | 행동                          |
| --------------------- | ----------------------------- |
| 다른 패키지 수정 필요 | 즉시 중단, 승인 요청          |
| SSOT 문서 수정        | 즉시 중단, 승인 요청          |
| Public Facade 수정    | export 목록 제시 후 승인 요청 |
| 아키텍처 변경         | 즉시 중단, 승인 요청          |

상세: [GOVERNANCE.md](GOVERNANCE.md) 참조

## 워크플로우

```bash
# 전체 검증 (tsc + lint + test)
bun run verify

# 개별 실행
bun run tsc        # 타입체크
bun run lint       # 린트
bun test           # 테스트
```

## 프로젝트 핵심 규칙

- **AOT 우선**: 런타임 스캔/리플렉션 금지, CLI가 생성한 메타데이터만 소비
- **패키지 경계 엄격**: Facade를 통해서만 import (`@bunner/pkg`, not `@bunner/pkg/src/**`)
- **Conventional Commits**: `type(scope): subject` 형식, 영어만
- **테스트 필수**: BDD 스타일 (`it('should ...', ...)`)

## 패키지 의존 매트릭스

| 소비자 → 제공자  | common | logger | core  | http-adapter | scalar | cli |
| ---------------- | ------ | ------ | ----- | ------------ | ------ | --- |
| **cli**          | ✅     | ❌     | ❌    | ❌           | ❌     | -   |
| **core**         | ✅     | ✅     | -     | ❌           | ❌     | ❌  |
| **http-adapter** | ✅(P)  | ✅(P)  | ✅(P) | -            | ❌     | ❌  |
| **scalar**       | ✅(P)  | ✅(P)  | ❌    | ❌           | -      | ❌  |

- ✅ = dependencies
- ✅(P) = peerDependencies
- ❌ = 금지

## 문서 탐색 가이드

| 상황           | 확인 문서                         |
| -------------- | --------------------------------- |
| 코드 스타일    | STYLEGUIDE.md → STRUCTURE.md      |
| 패키지 의존    | ARCHITECTURE.md → DEPENDENCIES.md |
| 테스트 작성    | TESTING.md → STYLEGUIDE.md        |
| 즉시 중단 여부 | POLICY.md → SAFEGUARDS.md         |
| 승인 요청      | GOVERNANCE.md → AGENTS.md         |
