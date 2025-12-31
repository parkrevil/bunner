# ARCHITECTURE

> **ARCHITECTURE.md는 이 레포에서 구조적으로 허용되는 것과 금지되는 것을 판정하는 최상위 규칙 문서다.**

---

## 1. 역할

- 시스템 구조, 의존 방향, 패키지 경계, Facade 규칙을 정의한다.
- 모노레포 무결성 및 AOT 결정성에 영향을 주는 구조적 규칙을 명시한다.
- 이 문서에 정의된 규칙으로 “이 변경이 허용되는가?”를 판정할 수 있어야 한다.

---

## 2. 적용 범위

- 본 문서는 레포 전체에 적용된다.
- `packages/*`, `examples/*`, `tooling/*`를 포함한다.

---

## 3. 정본 및 우선순위

- 프레임워크 전반 개념 및 용어의 정본(SSOT)은 SPEC.md다.
- 디렉토리/파일 배치 규칙은 STRUCTURE.md가 우선한다.
- 이 문서에 정의된 규칙은 구현 세부, 코드 스타일, 도구 선택보다 우선한다.
- **Extended SSOT(`docs/architecture/`)는 본 문서의 상세 규칙을 정의하며, 본 문서와 충돌 시 본 문서가 우선한다(MUST).**

본 문서는 패키지 경계 및 의존성 판정에 필요한 최소한의 개념 정의만을 포함한다.  
프레임워크 전반 개념 및 용어의 정본(SSOT)은 SPEC.md에 있으며,  
ARCHITECTURE.md는 이를 중복 정의하지 않는다.

---

## 4. 문서 지도

### 루트 SSOT (판정 기준)

| 문서            | 역할                             |
| --------------- | -------------------------------- |
| SPEC.md         | 프레임워크 개념, 용어, 설계 목표 |
| ARCHITECTURE.md | 구조 규칙, 의존 판정, 경계 정의  |
| STRUCTURE.md    | 디렉토리/파일 배치               |
| STYLEGUIDE.md   | 코딩 스타일, 네이밍              |
| TOOLING.md      | CLI, 스크립트, 빌드/운영 정책    |
| DEPENDENCIES.md | package.json 의존성 선언 규칙    |

### docs/ 보조 문서 (Non-SSOT)

| 경로               | 역할                                              |
| ------------------ | ------------------------------------------------- |
| docs/governance/   | 운영/정책 문서 (GOVERNANCE, POLICY, SECURITY 등)  |
| docs/design/       | 철학/배경/근거 문서 (VISION, INVARIANTS 등)       |
| docs/automation/   | 에이전트/자동화 실행 규칙 (AGENTS, GEMINI 실문서) |
| docs/reference/    | 요약/번역본 (QUICK_REFERENCE, README.ko)          |
| docs/architecture/ | Extended SSOT: 판정 상세 규칙                     |

---

## 5. 규범 용어 (Normative Keywords)

이 문서는 사람, 에이전트, CI가 동일한 판정을 내릴 수 있도록 규칙 강도를 다음 키워드로 정규화한다.

- MUST: 위반 시 변경은 거부되어야 한다.
- MUST NOT: 절대 금지이며, 위반 시 변경은 거부되어야 한다.
- SHOULD: 강력 권장이며, 예외가 필요하면 근거와 영향 범위를 함께 제시해야 한다.
- MAY: 선택 사항이다.

“예시”, “현재 구현”, “참고”로 표시된 내용은 비규범(Non-normative)이다.

---

## 6. 패키지 분류 (논리적 역할)

이 프로젝트는 Workspaces 기반 모노레포를 전제로 한다.  
구체적인 워크스페이스 구현 도구 선택은 아키텍처 판정 대상이 아니다.

패키지는 물리적 위치가 아닌 논리적 역할로 분류한다.

| 분류       | 설명                                             | 런타임 포함 | core 의존 |
| ---------- | ------------------------------------------------ | ----------- | --------- |
| foundation | 공통 유틸, 타입, 최소 기반                       | ✅          | ❌        |
| runtime    | 애플리케이션 런타임에 포함되는 핵심 패키지       | ✅          | -         |
| adapter    | 프로토콜/환경별 연결 계층                        | ✅          | ✅(P)     |
| plugin     | 선택적 확장 기능 (tooling-only 또는 런타임 확장) | ⚠️ 선택적   | ❌        |
| cli        | 개발자/운영자용 실행 도구                        | ❌          | ❌        |
| examples   | 예제 및 참고 구현                                | ❌          | ✅        |

> **plugin 불변식**: plugin은 foundation만 의존할 수 있으며(MUST), runtime/core를 직접 의존하면 안 된다(MUST NOT). 런타임 포함 여부는 package.json의 `bunner.runtime` 필드로 선언한다.

### 현재 패키지 매핑

| 패키지                 | 분류       |
| ---------------------- | ---------- |
| `@bunner/common`       | foundation |
| `@bunner/logger`       | foundation |
| `@bunner/core`         | runtime    |
| `@bunner/http-adapter` | adapter    |
| `@bunner/scalar`       | plugin     |
| `@bunner/cli`          | cli        |
| `examples/*`           | examples   |

---

## 7. 단방향 의존 규칙 (패키지 레벨)

- 의존성은 단방향이어야 한다(MUST).
- 하위 계층은 상위 계층을 의존할 수 없다(MUST NOT).
- 순환 의존은 금지된다(MUST NOT).

---

## 8. 패키지 의존 규칙 매트릭스

| 소비자 ↓ / 제공자 → | common | logger | core  | http-adapter | scalar | cli |
| ------------------- | ------ | ------ | ----- | ------------ | ------ | --- |
| common              | -      | ❌     | ❌    | ❌           | ❌     | ❌  |
| logger              | ❌     | -      | ❌    | ❌           | ❌     | ❌  |
| core                | ✅     | ✅     | -     | ❌           | ❌     | ❌  |
| http-adapter        | ✅(P)  | ✅(P)  | ✅(P) | -            | ❌     | ❌  |
| scalar              | ✅(P)  | ✅(P)  | ❌    | ❌           | -      | ❌  |
| cli                 | ✅     | ❌     | ❌    | ❌           | ❌     | -   |
| examples            | ✅     | ✅     | ✅    | ✅           | ✅     | ✅  |

- ✅ = dependencies로 의존 가능
- ✅(P) = peerDependencies로 의존
- ❌ = 의존 금지

peerDependencies 강제는 런타임 단일성 보장을 위한 아키텍처 결정이다.

---

## 9. 패키지 경계 및 Facade 규칙

### 9.1 Public Facade

- 각 패키지는 단일 Public Facade를 가져야 한다.
- Facade는 패키지 루트의 `index.ts`다.

### 9.2 Deep Import 금지

- Facade를 우회하는 모든 import는 Deep Import다.
- Deep Import는 MUST NOT다.

### 9.3 Public API 판정

Public API 여부는 각 패키지의 index.ts(export facade)를 기준으로 판정한다.  
index.ts에 노출되지 않은 심볼은 private로 간주한다.

### 9.4 안티패턴 예시 (비규범)

| 상황                     | ❌ 잘못된 import                           | ✅ 올바른 import        |
| ------------------------ | ------------------------------------------ | ----------------------- |
| 패키지 내부 접근         | `@bunner/core/src/container`               | `@bunner/core`          |
| CLI에서 코어/어댑터 의존 | `import { Container } from '@bunner/core'` | `@bunner/common`만 허용 |
| 상대 경로 탈출           | `../../another-pkg/src/...`                | Facade 통한 import      |

---

## 10. 아키텍처 위반 등급 및 조치

| 등급    | 설명                          | 필수 조치             |
| ------- | ----------------------------- | --------------------- |
| Level 1 | 구조 붕괴 또는 결정성 파괴    | 즉시 중단 + 롤백 필수 |
| Level 2 | 경계 침범 또는 의존 방향 위반 | 즉시 중단 + 승인 요청 |
| Level 3 | 권장 규칙 위반                | 경고 + 근거 제시 필요 |

Level 1/2 위반은 변경이 거부되어야 한다(MUST).

### 10.1 위반 유형별 등급 매핑

| 위반 유형                        | 등급    | 자동 검증           | 판정 기준                                                    |
| -------------------------------- | ------- | ------------------- | ------------------------------------------------------------ |
| 순환 의존성 도입                 | Level 1 | ✅ (madge)          | 패키지 간 import 그래프 순환                                 |
| reflect-metadata 사용            | Level 1 | ✅ (grep)           | `reflect-metadata` import 존재                               |
| 데코레이터에 런타임 의미 도입    | Level 1 | ⚠️ (ast, heuristic) | 데코레이터 함수 내 side-effect 문 존재                       |
| 환경/시간/랜덤 의존 산출물       | Level 1 | ⚠️ (ast, heuristic) | 직접 호출(`Date.now()`, `Math.random()`, `process.env`) 검출 |
| import side-effect               | Level 1 | ✅ (eslint)         | bare import 문 존재                                          |
| 런타임 동적 등록                 | Level 1 | ⚠️ (ast, heuristic) | `container.register()` 등 등록 패턴 호출                     |
| Deep Import                      | Level 2 | ✅ (eslint)         | 패키지 내부 경로 import                                      |
| Facade 우회                      | Level 2 | ✅ (eslint)         | index.ts 미경유 import                                       |
| 의존 매트릭스 위반               | Level 2 | ✅ (lint)           | 섹션 8 매트릭스 불일치                                       |
| 사용자 정의 데코레이터 정책 위반 | Level 2 | ⚠️ (ast)            | factory 미사용 데코레이터 정의                               |
| 신고 엔트리 런타임 포함          | Level 2 | ✅ (bundler)        | `*.manifest.ts` 파일 런타임 번들 포함                        |
| 네이밍 규칙 위반                 | Level 3 | ✅ (eslint)         | STYLEGUIDE.md 규칙 불일치                                    |

> **⚠️ 표기**: heuristic 기반 검증은 오탐/누락 가능성이 있으며, 최종 판정은 리뷰어가 수행한다.

---

## 11. 아키텍처 변경 정의

다음은 아키텍처 변경으로 간주한다.

- 패키지 분류 변경
- 의존 방향 변경
- Facade 규칙 변경
- 결정성 규칙 변경
- **코어 데코레이터 추가/성격 변경**

아키텍처 변경은 명시적 승인 없이는 불가하다(MUST).

---

## 12. AOT 결정성 규칙

런타임 구조는 AOT 관점에서 결정 가능해야 한다(MUST).

### 12.1 금지 항목 (MUST NOT)

- 동적 로딩 (`import()` 동적 호출)
- 전역 상태 의존
- 환경/시간/랜덤/IO 의존 결과 생성
- import side-effect
- 런타임 동적 등록/조회

### 12.2 결정성 위반 대표 패턴 (비규범 예시)

다음은 12.1을 위반하는 대표적 패턴이다:

- **import-time side-effect**: 모듈 로드 시 전역 상태 변경
- **dynamic import**: 조건부 `import()` 호출
- **global mutable singleton**: 전역 변수 기반 상태 공유
- **non-deterministic IO in build step**: 빌드 시점 네트워크/파일 IO 의존

---

## 13. Architecture Gardening

### 13.1 원칙

- 구조 정리는 목적을 가져야 한다.
- 구조 정리는 불변식을 강화해야 한다.

### 13.2 트리거 없는 정리 금지

트리거 없는 구조 정리는 SHOULD NOT다.

여기서 트리거란, 측정 가능한 아키텍처 위반,  
의존 그래프 악화, 결정성 붕괴 위험,  
또는 명시된 개선 목표를 의미한다.

---

## 14. 모노레포 무결성

- 패키지는 명시된 경계 밖으로 탈출할 수 없다.
- 상대 경로를 통한 경계 우회는 MUST NOT다.

아키텍처 판정과 직접 관련 없는 산출물 관리 및 커밋 정책은  
TOOLING.md에서 정의한다.

---

## 15. 변경 전 체크리스트

- [ ] 이 변경은 단방향 의존 규칙을 위반하는가?
- [ ] Facade를 우회하는가?
- [ ] AOT 결정성을 해치는가?
- [ ] 아키텍처 변경인가?
- [ ] 위반 시 승인을 받았는가?

---

## 16. 에이전트 판정 알고리즘 (Agent Decision Protocol)

에이전트는 변경을 수행하기 전에 다음 순서로 판정해야 한다(MUST).

### 16.1 의존성 변경 판정

```text
1. 변경이 패키지 간 의존을 추가/수정하는가?
   ├─ YES → 섹션 8 매트릭스 확인
   │         ├─ 허용(✅) → 진행
   │         ├─ peerDependencies(✅(P)) → peerDependencies로 선언
   │         └─ 금지(❌) → 즉시 중단, 승인 요청
   └─ NO → 다음 단계
```

### 16.2 Import 경로 판정

```text
1. import 경로가 다른 패키지를 참조하는가?
   ├─ YES → Deep Import 여부 확인
   │         ├─ 패키지 루트(예: '@bunner/core') → 허용
   │         └─ 내부 경로(예: '@bunner/core/src/...') → 즉시 중단
   └─ NO → 허용
```

### 16.3 구조 변경 판정

```text
1. 변경이 섹션 11의 "아키텍처 변경"에 해당하는가?
   ├─ 패키지 분류 변경 → 승인 필요
   ├─ 의존 방향 변경 → 승인 필요
   ├─ Facade 규칙 변경 → 승인 필요
   ├─ 결정성 규칙 변경 → 승인 필요
   └─ 해당 없음 → 진행
```

### 16.4 위반 등급 판정

```text
1. 변경이 위반을 유발할 가능성이 있는가?
   ├─ 섹션 10.1 매핑표 참조
   ├─ Level 1 → 즉시 중단 + 롤백 필수
   ├─ Level 2 → 즉시 중단 + 승인 요청
   └─ Level 3 → 경고 + 근거 제시
```

---

## 17. 데코레이터 규칙 (Decorator Policy)

### 17.1 데코레이터의 본질

모든 데코레이터(코어/어댑터/사용자 정의)는 **빌드타임 인식 대상의 선언(마커)**이다.

금지 사항(MUST NOT):

- 런타임 실행 의미(등록/조회/side-effect)
- 전역 상태 변경
- import 시 side-effect

### 17.2 코어 데코레이터 경계

프레임워크 코어가 제공하는 데코레이터는 **마커(no-op) 성격**이어야 한다(MUST).

**코어 데코레이터 목록 (exhaustive)**:

- `@Injectable` — `@bunner/common` 제공
- `@Context` — `@bunner/common` 제공

> 코어 데코레이터의 소유 패키지는 `@bunner/common`이다. `@bunner/core`는 runtime 분류이며 데코레이터를 제공하지 않는다.

### 17.3 사용자 정의 데코레이터

사용자 정의 데코레이터는 **자유 형태 금지**(MUST NOT).

허용되는 형태는 프레임워크가 제공하는 **factory로 생성된 범주만 허용**:

- ParamResolver
- Guard
- Pipe
- Interceptor
- ErrorFilter

---

## 18. 확장 모델 (Extension Model)

### 18.1 어댑터 확장 계약 (Adapter Extension Contract)

adapter 패키지는 "내가 제공하는 데코레이터/확장 포인트"를 **정적으로 신고해야 한다**(MUST).

금지 사항(MUST NOT):

- 런타임에서 동적 등록 ("나 이거 제공/사용")

### 18.2 빌드 전용 경계 (Build-only Boundary)

adapter의 신고/등록 엔트리는 **빌드타임 전용**이다(MUST).

런타임 번들 포함은 금지된다(MUST NOT).

**신고 엔트리 식별 기준**:

- 파일명: `*.manifest.ts` 패턴
- 또는 package.json의 `bunner.manifest` 필드로 지정된 파일
- 해당 파일은 번들러 설정에서 external로 처리되어야 한다(MUST)

### 18.3 등록 범위 제한 (Registration Scope)

"등록/보고"는 **adapter/plugin 등 확장 패키지에만 적용**된다.

foundation(common 등)은 등록하지 않는다(MUST NOT).
