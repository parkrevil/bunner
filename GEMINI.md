# Antigravity (Gemini) AI Agent Instructions

이 문서는 Antigravity(Gemini 기반 에이전트)를 위한 규칙 요약입니다.

## 필독 문서 순서

1. **[SPEC.md](SPEC.md)** - 최상위 불변조건 (SSOT)
2. **[INVARIANTS.md](INVARIANTS.md)** - Bunner의 불변의 법칙
3. **[AGENTS.md](AGENTS.md)** - 에이전트 집행 규칙
4. **[ARCHITECTURE.md](ARCHITECTURE.md)** - 패키지 경계/의존
5. **[STYLEGUIDE.md](STYLEGUIDE.md)** - 코딩 스타일

## 즉시 중단 조건 (Hard Stops)

아래 조건 중 하나라도 해당하면 **즉시 중단**:

| 카테고리 | 조건                                   | 상세 SSOT     |
| -------- | -------------------------------------- | ------------- |
| **보안** | 민감정보(키/토큰/비밀번호) 코드에 포함 | POLICY.md     |
| **AOT**  | `reflect-metadata` 사용                | POLICY.md     |
| **AOT**  | 런타임 리플렉션/스캔 도입              | POLICY.md     |
| **AOT**  | 비결정적 산출물(시간/랜덤 의존)        | POLICY.md     |
| **경계** | 다른 패키지 `src/**` 직접 import       | POLICY.md     |
| **경계** | 순환 의존성 도입                       | POLICY.md     |
| **계약** | Public Facade 무단 변경                | POLICY.md     |
| **계약** | Silent breaking change                 | POLICY.md     |
| **폭주** | 동일 구간 3회 이상 수정 반복           | SAFEGUARDS.md |

## 작업 전 체크리스트

- [ ] 작업 범위가 명확한가?
- [ ] 패키지 경계를 넘는 변경인가? → 승인 요청
- [ ] Public API 변경인가? → 승인 요청
- [ ] 테스트가 필요한 변경인가?
- [ ] 관련 SSOT 문서를 확인했는가?

## 실패 시 행동 가이드

| 실패 유형           | 즉시 행동      | 후속 행동                             |
| ------------------- | -------------- | ------------------------------------- |
| 규칙을 따를 수 없음 | 즉시 중단      | 상황 설명 + 대안 제시                 |
| verify 실패         | 원인 분석      | 범위 내 수정 시도 → 불가 시 승인 요청 |
| 승인 거부됨         | 현재 접근 포기 | 대안 탐색 후 재제안 or 작업 종료      |
| 해석 모호함         | 즉시 중단      | 가능한 해석 나열 + 결정 요청          |
| 예상치 못한 에러    | 즉시 중단      | 에러 내용 상세 보고                   |

**기본 원칙**: 불확실하면 **추측하지 말고 중단** 후 확인 요청

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
bun run architecture:check  # 아키텍처 검증
```

## 프로젝트 핵심 규칙

- **AOT 우선**: 런타임 스캔/리플렉션 금지, CLI가 생성한 메타데이터만 소비
- **Bun Native**: Node.js 호환보다 Bun 네이티브 API 우선
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
| 불변조건       | SPEC.md → INVARIANTS.md           |
| 코드 스타일    | STYLEGUIDE.md → STRUCTURE.md      |
| 패키지 의존    | ARCHITECTURE.md → DEPENDENCIES.md |
| 테스트 작성    | TESTING.md → STYLEGUIDE.md        |
| 즉시 중단 여부 | POLICY.md → SAFEGUARDS.md         |
| 승인 요청      | GOVERNANCE.md → AGENTS.md         |
| CLI/AOT        | TOOLING.md → ARCHITECTURE.md      |
| 데드 코드      | DEAD_CODE_POLICY.md               |
| 커밋           | COMMITS.md                        |

## Antigravity 특화 규칙

- **task_boundary 사용**: 복잡한 작업 시 task_boundary 도구로 진행 상황 관리
- **artifact 생성**: 계획/워크스루는 `brain/<conversation-id>/` 디렉토리에 저장
- **notify_user**: 작업 중 사용자에게 알릴 내용은 notify_user 도구 사용
- **범위 제한**: 사용자 요청 범위 내에서만 작업 (MUST)
