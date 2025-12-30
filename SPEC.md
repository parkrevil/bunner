# SPEC (SSOT)

## 역할

- **이 문서는 Bunner 프로젝트의 최상위 정본(Single Source of Truth)이다.**

---

이 문서는 Bunner 프로젝트의 **최상위 정본(SSOT)** 이다.

- **우선순위**: 이 문서의 규칙은 프로젝트 내 다른 어떤 문서/도구/관행보다 우선한다.
- **목표**: 아키텍처 일관성, 확장성, 유지보수성, 안정성, 그리고 AOT 결정성을 보장한다.

## 목적

- 프로젝트 규칙의 최종 우선순위를 제공한다.
- AOT/AST/결정성 같은 핵심 불변조건을 SSOT로 고정한다.

## 적용 범위

- 이 문서는 레포 전체(워크스페이스/패키지/예제 포함)에 적용한다.
- 이 불변조건은 기본적으로 레포 전체에 적용된다.
- 실험/임시 코드는 불변조건을 위반해서는 안 되며, 예외는 [GOVERNANCE.md](GOVERNANCE.md)의 승인 없이는 허용되지 않는다.
- 이 불변조건은 저장소에 커밋되는 모든 코드에 동일하게 적용된다.
- 생성물의 저장소 반입 여부 및 예외는 [ARCHITECTURE.md](ARCHITECTURE.md)와
  [POLICY.md](POLICY.md)가 SSOT다.

## 충돌 해결

- 다른 문서가 이 문서와 충돌하면, 이 문서를 우선한다.
- 이 문서의 변경 승인/권한은 [GOVERNANCE.md](GOVERNANCE.md)를 따른다.

## 규범 용어 (Normative Keywords)

- MUST: 반드시 따라야 하며, 위반은 허용되지 않는다.
- MUST NOT: 절대 금지이며, 위반은 허용되지 않는다.
- SHOULD: 강력 권장이며, 예외가 필요하면 근거와 영향 범위를 함께 제시해야 한다.
- MAY: 선택 사항이다.

하위 SSOT 문서는 SPEC 불변조건을 완화하거나 충돌해서는 안 된다(MUST NOT).

SPEC 불변조건을 추가하거나 강화하는 변경도 [GOVERNANCE.md](GOVERNANCE.md)의 승인이 필요하다.

다음 변경은 SPEC 불변조건의 **의미 범위 또는 집행 대상**을 약화시키는 것으로 간주하며,
SPEC 변경으로 취급해 [GOVERNANCE.md](GOVERNANCE.md)의 승인이 선행되어야 한다.

- 금지(MUST NOT) 항목을 허용으로 변경하는 경우
- MUST/MUST NOT을 SHOULD/MAY로 완화하는 경우
- 승인/검증/중단 같은 게이트 조건을 제거하거나 회피 가능하게 만드는 경우
- 규칙은 유지하되, 우회 경로 또는 예외 경로를 암묵적으로 추가하는 경우

## 문서 지도 (정본 위치)

### 핵심 SSOT (불변조건/경계/승인)

- 위반 시 즉시 중단 정책: [POLICY.md](POLICY.md)
- 변경 승인/권한: [GOVERNANCE.md](GOVERNANCE.md)
- 아키텍처/경계/불변조건: [ARCHITECTURE.md](ARCHITECTURE.md)
- 구조/파일 배치: [STRUCTURE.md](STRUCTURE.md)
- 의존성 선언(`package.json`): [DEPENDENCIES.md](DEPENDENCIES.md)

### 에이전트/자동화 SSOT (집행/실행)

- 에이전트 집행 규칙: [AGENTS.md](AGENTS.md)
- 자동화 범위: [AUTOMATION.md](AUTOMATION.md)
- 폭주 방지/중단 기준: [SAFEGUARDS.md](SAFEGUARDS.md)
- 툴링/CLI 운영 정책: [TOOLING.md](TOOLING.md)

### 품질/스타일 SSOT

- 코딩 스타일: [STYLEGUIDE.md](STYLEGUIDE.md)
- 테스트 표준: [TESTING.md](TESTING.md)
- 데드 코드 정책: [DEAD_CODE_POLICY.md](DEAD_CODE_POLICY.md)

### 기여/커밋 SSOT

- 커밋 규칙: [COMMITS.md](COMMITS.md)
- 기여 가이드: [CONTRIBUTING.md](CONTRIBUTING.md)

### 문서 탐색 결정 트리 (Quick Navigation)

| 상황             | 1차 확인                                   | 2차 확인                           |
| ---------------- | ------------------------------------------ | ---------------------------------- |
| 코드 작성/스타일 | [STYLEGUIDE.md](STYLEGUIDE.md)             | [STRUCTURE.md](STRUCTURE.md)       |
| 패키지 의존/경계 | [ARCHITECTURE.md](ARCHITECTURE.md)         | [DEPENDENCIES.md](DEPENDENCIES.md) |
| 테스트 작성      | [TESTING.md](TESTING.md)                   | [STYLEGUIDE.md](STYLEGUIDE.md)     |
| 커밋/PR          | [COMMITS.md](COMMITS.md)                   | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 에이전트 행동    | [AGENTS.md](AGENTS.md)                     | [POLICY.md](POLICY.md)             |
| 즉시 중단 여부   | [POLICY.md](POLICY.md)                     | [SAFEGUARDS.md](SAFEGUARDS.md)     |
| 승인 필요 여부   | [GOVERNANCE.md](GOVERNANCE.md)             | [AGENTS.md](AGENTS.md)             |
| CLI/AOT 변경     | [TOOLING.md](TOOLING.md)                   | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 데드 코드 제거   | [DEAD_CODE_POLICY.md](DEAD_CODE_POLICY.md) | -                                  |

## 최상위 불변조건 (Project Invariants)

이 문서는 “모든 하위 규칙의 근거가 되는 불변조건”만을 고정한다.
세부 규칙은 각 하위 SSOT 문서가 소유하며, SPEC는 필요 이상으로 세부를 중복 기재하지 않는다.

### 불변조건 요약표 (Quick Reference)

| 카테고리        | 불변조건                       | 키워드   | 위반 시   |
| --------------- | ------------------------------ | -------- | --------- |
| **패키지 경계** | Public Facade로만 참조         | MUST     | 즉시 거부 |
| **패키지 경계** | cross-package deep import 금지 | MUST NOT | 즉시 거부 |
| **계약**        | Public API 무단 변경 금지      | MUST NOT | 승인 필요 |
| **검증**        | 모든 패키지 검증 가능          | MUST     | 빌드 실패 |
| **AOT**         | reflect-metadata 전면 금지     | MUST NOT | 즉시 거부 |
| **AOT**         | 런타임 스캔/리플렉션 금지      | MUST NOT | 즉시 거부 |
| **AST**         | 동일 입력 → 동일 결과          | MUST     | 빌드 실패 |
| **AST**         | 순환 의존성 금지               | MUST NOT | 즉시 실패 |

### 패키지 경계 / Facade 불변조건

- 배포/의존의 단위는 `packages/*` 패키지이며,
  패키지 간 참조는 public facade로만 해야 한다(MUST).
- cross-package deep import(다른 패키지의 내부 경로 import)는
  도입해서는 안 된다(MUST NOT).
- public API/Contract 변경은 승인 없이 묵시적으로 수행해서는 안 된다(MUST NOT).

여기서 public facade는 패키지 엔트리포인트로 **명시적으로 노출된 경로만**을 의미한다
(예: `package.json`의 `exports` 또는 엔트리포인트가 가리키는 루트 파일).

패키지 경계/Facade의 상세 판정 기준은
[ARCHITECTURE.md](ARCHITECTURE.md)가 SSOT다.

### 패키지 기본 검증 가능성

- 모든 패키지는 검증 가능해야 한다(MUST).

검증의 강제/차단 기준은 [TESTING.md](TESTING.md),
실행 안전장치/중단/롤백은 [SAFEGUARDS.md](SAFEGUARDS.md)가 SSOT다.

## AOT (핵심 가치)

1. AOT 컴파일러는 Bunner Framework의 핵심 가치이며,
   설계/구현의 최우선 제약이다.
2. 모든 기능은 “런타임 추론/스캔/반사(reflection)”가 아니라
   “CLI 기반 AOT 산출물”을 전제로 설계해야 한다.
3. `reflect-metadata` 사용은 **전면 금지**다. 예외는 없다.
4. AOT 결과물/레지스트리(`__BUNNER_METADATA_REGISTRY__`)를
   런타임이나 외부에서 임의로 수정/패치/주입하려는 시도는 **금지**다.
   - 이 금지는 모든 실행 환경에 동일하게 적용된다.
5. 런타임 오버헤드를 유발하는 문제(스캔, 반사, 동적 탐색)는
   “편의상 런타임에서 처리”하지 말고,
   AOT/CLI 단계에서 해결해야 한다.
6. 모든 런타임 의존성은 AOT 시점에
   정적으로 분석 가능해야 한다(MUST).

CLI 설치/운영 정책 및 CLI 산출물(Registry/Plan)에 대한 상세는
[TOOLING.md](TOOLING.md)가 SSOT다.

## AST (의존성 트리)

이 섹션은 AST 분석의 “구현 명세”가 아니라,
Bunner의 최상위 불변조건만을 고정한다.

AST 불변조건은 AOT 결정성을 보조하기 위한 최소 제약이다.

### 불변조건

- 런타임은 소스를 스캔하지 않으며,
  CLI가 생성한 의존 그래프 및 산출물(Registry/Plan)만 소비한다.
- 분석/산출은 동일 입력(코드/락파일/설정)에서
  동일 결과가 나와야 한다(결정성/재현성).
- 순환 의존성은 ‘경고’가 아니라 실패로 취급한다.
- 분석/해석 실패는 성공으로 위장되어서는 안 된다.

분석 해석(Resolution), 수집 규칙, 에러 메시지/분류,
산출물 포맷 같은 구현 세부의 SSOT는
[TOOLING.md](TOOLING.md)다.

## 엣지 케이스 처리 원칙

| 상황             | 원칙           | 행동                   |
| ---------------- | -------------- | ---------------------- |
| 문서 간 충돌     | SPEC.md 우선   | 다른 문서의 규칙 무시  |
| 규칙 해석 모호   | 추측 금지      | 중단 + 확인 요청       |
| 예외 필요        | 사전 승인 필수 | GOVERNANCE.md 절차     |
| 긴급 상황        | 최소 수정      | 수정 후 즉시 승인 요청 |
| 규칙 불이행 불가 | 작업 종료      | 사유 + 대안 보고       |

## 불변조건 위반 예시 (Anti-patterns)

| 불변조건         | ❌ 위반 예시                                     | ✅ 올바른 방법                     |
| ---------------- | ------------------------------------------------ | ---------------------------------- |
| Public Facade    | `import { X } from '@bunner/core/src/container'` | `import { X } from '@bunner/core'` |
| AOT 결정성       | `Date.now()`로 코드 생성                         | 고정 시드 또는 입력 기반           |
| reflect-metadata | `import 'reflect-metadata'`                      | CLI AOT 메타데이터 사용            |
| 순환 의존        | A→B→C→A 구조                                     | 의존 방향 재설계                   |
| 레지스트리 수정  | `__BUNNER_METADATA_REGISTRY__.set(...)`          | CLI만 레지스트리 생성              |

## 실행 체크리스트

- [ ] 패키지 경계를 넘는 import가 Public Facade를 통하는가?
- [ ] cross-package deep import가 없는가?
- [ ] Public API/Contract를 변경하려면 승인을 받았는가?
- [ ] reflect-metadata를 사용하지 않는가?
- [ ] 런타임 스캔/리플렉션을 사용하지 않는가?
- [ ] AOT 산출물이 동일 입력에서 동일 결과를 내는가?
- [ ] 순환 의존성이 없는가?
- [ ] 검증(`bun run verify`)이 통과하는가?

## 1. 디렉토리 구조 및 모노레포

- **전략:** Bun Workspaces로 관리되는 모노레포.
- **패키지 구성:**
  - `packages/core`: DI, 컴파일러, 런타임 (심장부).
  - `packages/common`: 데코레이터, 인터페이스, 유틸리티.
  - `packages/router`: 트라이(Trie) 기반 최적화된 HTTP 라우터.
  - `packages/platform-bun`: Bun 전용 어댑터.
  - `packages/testing`: 테스트 유틸리티 (TestContainer).
  - `packages/data`: Drizzle 래퍼 및 AOT 매퍼.
  - `packages/docs`: OpenAPI/AsyncAPI UI 생성기.

## 2. AOT 컴파일러 및 CLI

- **역할:** 사용자 코드(AST)를 분석하여 최적화된 "명령어 집합(Instruction Sets)"(팩토리, 직렬화 함수)을 생성.
- **출력:** `.bunner` 디렉토리를 생성하며 다음을 포함:
  - `__module_graph__.ts`: 정적 DI 팩토리 맵 (Angular Ivy 스타일).
  - `__serializers__.ts`: JSON 문자열 빌더 함수.
  - `__validators__.ts`: 컴파일된 검증 로직.
  - `__manifest__.json`: OpenAPI/Docs용 메타데이터.

## 3. 런타임 아키텍처

### 3.1. 의존성 주입 (DI)

- **패턴:** 컴파일 타임 팩토리 패턴.
- **메커니즘:** `user.service.ts` -> (컴파일됨) -> `user.service.factory.ts`. 런타임은 단순히 팩토리 함수를 실행할 뿐임.

### 3.2. 설정 관리

- **로더:** 플러그형 로더 지원 (DotEnv, Cloud Param Store).
- **파이프라인:** 로드 -> 병합 -> 검증(스키마) -> 동결(Freeze) -> 주입.

## 4. 인터페이스 및 어댑터

### 4.1. 컨트롤러

- **스타일:** 메서드 데코레이터가 있는 클래스 기반.
- **주입:**
  - `@Body() dto: UserDto`: 검증 및 하이드레이션 완료된 데이터.
  - `@Query() params: ParamsDto`: 타입 안전한 쿼리 파라미터.
  - `@Context() ctx: HttpContext`: 로우 레벨 제어 (헤더, 쿠키).
- **응답:**
  - `T` | `Promise<T>` | `Result<T, E>` 반환 가능.
  - AOT 직렬화기가 자동으로 처리.

### 4.2. 인터셉터 및 가드

- **가드 인터페이스:** `canActivate(context): boolean | Promise<boolean>`.
  - `true` 반환 시 통과, `false` 시 Forbidden 예외 발생.
- **인터셉터 인터페이스:** `intercept(context, next): Promise<any>`.
  - **래핑:** `const res = await next.handle(); return { data: res };`
  - RxJS가 아닌 네이티브 Promise 사용.

## 5. 데이터 계층 (Drizzle 래퍼)

- **컨셉:** "코드 우선 엔티티, 엔진은 Drizzle."
- **엔티티 정의:**

  ```typescript
  @Entity('users')
  export class User {
    @PrimaryGeneratedColumn() id: number;
    @Column() name: string;

    // 도메인 로직 포함 가능
    validate() { ... }
  }
  ```

- **리포지토리:**
  - Drizzle 쿼리를 래핑한 제네릭 `Repository<T>`.
  - **AOT 하이드레이터:** 생성된 코드를 사용하여 `Drizzle Result (JSON)` -> `Entity Instance`로 자동 매핑.
  - **추론:** Drizzle의 `InferSelectModel`과 통합 지원.

## 6. 예외 처리

- **흐름:** 버블링 (메서드 -> 컨트롤러 -> 글로벌).
- **기본 필터:** `HttpException` 및 `Error` 포착 -> RFC 7807 JSON으로 변환.
- **커스터마이징:** `bunner.config.ts` 또는 `@UseFilters()`를 통해 재정의 가능.

## 7. 동시성 전략

- **기본:** 클러스터링을 위해 `Bun.serve({ reusePort: true })` 사용.
- **워커 오프로딩:**
  - 데코레이터: 메서드에 `@Compute()` 사용.
  - **제약:** 메서드는 순수 함수여야 하거나(상태 접근 금지), 프록시 가능한 특정 컨텍스트(Logger)만 허용됨.
  - **구현:** 컴파일러가 해당 메서드를 별도의 워커 진입점으로 추출.
