# Dependency Injection Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 Bunner의 DI 그래프 판정 및 정적 연결(wiring)이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 DI의 ‘연결 규칙’과 그래프 판정(순환/해결)을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- Provider 생명주기(init/dispose, scope 의미론) → provider.spec.md에서 판정된다.
- 공통 타입(Result/Error/Token)의 정의 → common.spec.md에서 판정된다.

## Definitions

- Wiring: 빌드 타임에 확정된 정적 연결 코드(또는 계획).
- Dependency Cycle: 의존성 그래프에서 순환 경로가 존재하는 상태.

## Invariants

- DI 연결은 빌드 타임에 확정되어야 한다.
- 순환 의존은 빌드 실패로 판정된다.
- 런타임 토큰 조회/동적 해석 없이 정적 그래프만 사용해야 한다.

- `common.spec.md`의 `InjectCall`은 런타임 조회가 아니라 빌드 타임 판정 입력이다.

## MUST

- DI 그래프는 Manifest 기반으로 정적으로 구성되어야 한다.
- DI 토큰은 정적으로 선언 가능한 형태(클래스 생성자 또는 `unique symbol`)만 허용되어야 한다.
- 순환 의존이 발견되면 빌드를 중단하고 순환 경로를 출력해야 한다.
  - 진단 출력 형식은 diagnostics.spec.md의 Cycle 및 Diagnostic 형식을 따라야 한다.
- DI 해석 결과는 런타임에서 동적으로 변경될 수 없다.
- `common.spec.md`에 정의된 `InjectCall`은 빌드 타임에 정적 wiring으로 치환 가능해야 한다.

- `InjectCall`은 앱 내부 실행 경로 전반에서 해석 가능해야 한다.
  - 최소 범위: middleware, guard, handler, error filter

- `common.spec.md`의 `InjectableOptions.visibleTo`는 아래 규칙으로 해석되어야 한다.
  - visibleTo가 생략된 경우, `module`로 판정되어야 한다.
  - visibleTo가 `all | module` 중 하나로 판정 가능해야 한다.
  - visibleTo가 `ModuleRefList`로 판정 가능해야 한다.
  - visibleTo는 혼합될 수 없다. (문자열 또는 배열 중 하나)

- visibleTo의 의미론은 아래와 같아야 한다.
  - `module`: Provider가 선언된 모듈과 동일한 모듈에서만 주입/접근이 허용되어야 한다.
  - `all`: 앱 내부 모든 모듈에서 주입/접근이 허용되어야 한다.
  - `ModuleRefList`: 리스트에 포함된 모듈에서만 주입/접근이 허용되어야 한다.

- `ModuleRefList`의 각 `ModuleRef`는 빌드 타임에 해당 모듈(ModuleId)로 정규화되어야 한다.
  - 정규화 결과는 중복이 제거되어야 하며, 결정적 순서를 가져야 한다.

- App-External Code에서 DI 결과에 접근해야 하는 경우, 접근 경로는 `app.get(Token)`이어야 한다.

- `app.get(Token)`은 아래 조건을 모두 만족하는 경우에만 성공해야 한다.
  - Token의 Provider scope는 `singleton`이어야 한다.
  - Token의 Provider visibleTo는 `all`이어야 한다.

- DI 그래프에 순환 의존이 존재하는 경우, 각 순환 경로에는 최소 1개 이상의 lazy 의존이 포함되어야 한다.
  - lazy 의존은 `InjectCall`에서 `inject(() => Token)` 형태로 선언된 의존을 의미한다.
  - 위 조건을 만족하지 못하면 빌드 실패로 판정되어야 한다.

## MUST NOT

- 런타임에서 반사(reflection) 또는 컨테이너 자동 스캔으로 의존을 해결해서는 안 된다.
- “없는 의존은 null/undefined로 주입” 같은 묵시적 완화를 허용해서는 안 된다.
- 런타임 토큰 조회(서비스 로케이터, 동적 문자열 토큰 등)를 허용해서는 안 된다. (정적 그래프 밖 해석 금지)

- 런타임의 `inject()`는 토큰을 해결(resolve)하거나, 컨테이너 조회를 수행해서는 안 된다.

- `inject(() => Token)`의 thunk는 런타임에서 실행되거나 토큰 해결에 사용되어서는 안 된다.

- `app.get(Token)`이 아래 조건을 위반하여 성공하는 것을 허용해서는 안 된다.
  - Token의 Provider scope가 `request | transient`인 경우
  - Token의 Provider visibleTo가 `module` 또는 `ModuleRefList`인 경우

## Handoff

- 그래프의 노드(Provider/Component/Factory 등)의 생명주기 의미론은 provider.spec.md로 이관된다.
- Wiring 산출물의 형식은 manifest.spec.md로 이관된다.

## Observable Semantics

- `common.spec.md`의 `InjectCall`은 런타임 조회 API가 아니라, 빌드 타임에 해석되는 선언으로 취급되어야 한다.
- 런타임에는 정적 wiring에 의해 확정된 연결만 존재해야 한다.

## Violation Conditions

- 순환 의존이 존재하는데도 빌드가 성공하는 경우
- 런타임에서 DI 연결이 변경되는 경우
- 런타임 토큰 조회나 동적 토큰 해석이 발견되는데 빌드가 성공하는 경우

- Runtime Violation: App-External Code에서 `inject()` 호출이 관측되는 경우
- Runtime Violation: `app.get(Token)`이 `singleton`이 아닌 토큰에 대해 성공하는 경우
- Runtime Violation: `app.get(Token)`이 visibleTo가 `all`이 아닌 토큰에 대해 성공하는 경우

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
