# SPEC (SSOT)

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

## 최상위 불변조건 (Project Invariants)

이 문서는 “모든 하위 규칙의 근거가 되는 불변조건”만을 고정한다.
세부 규칙은 각 하위 SSOT 문서가 소유하며, SPEC는 필요 이상으로 세부를 중복 기재하지 않는다.

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
