# Provider Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 Provider의 생명주기, 스코프, 리소스 관리 계약이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 init/dispose, scope, resource lifecycle을 판정 가능한 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- DI 그래프 연결 규칙 → di.spec.md에서 판정된다.
- 클러스터 모드의 프로세스 의미론 → cluster.spec.md에서 판정된다. (단, provider 의미론에 영향이 있으면 handoff로 연결)

## Definitions

- Provider: DI 그래프에 의해 생성/주입되는 대상이며, 명시된 생명주기를 가진다.
- Scope: Provider의 인스턴스 공유 범위(예: 전역/요청/모듈 등). 본 SPEC은 `singleton | request | transient`를 기본 집합으로 고정한다.
- Resource Provider: 외부 리소스(DB, 소켓 등)를 소유하며 종료(dispose)가 필요한 Provider.
- RequestContextId: 요청 컨텍스트를 식별하기 위한 정적 동일성 값.

## Invariants

- Provider 생명주기는 빌드 타임에 확정된 연결에 의해 결정되며 런타임 추론이 아니다.
- Scope 의미론은 빌드/부트 시점에 확정되며, 런타임 입력에 따라 암묵 변경되지 않는다.

## MUST

- Provider는 생성/초기화/종료 단계가 명확히 정의되어야 한다.

- Provider 초기화 순서는 의존성 그래프에 의해 결정되어야 한다.
  - Provider A가 Provider B에 의존한다면, B는 A보다 먼저 초기화되어야 한다.

- dispose가 필요한 Provider는 의존성 그래프의 역순으로 종료되어야 한다.
- Scope는 명시적으로 선언되거나 판정 가능해야 하며, 모호하면 빌드 실패로 판정되어야 한다.
- `singleton`은 프로세스/워커 단위로 1회 생성되어야 한다.
- `request`는 `RequestContextId`마다 별도 인스턴스를 생성해야 한다.
- `transient`는 주입 지점마다 새 인스턴스를 생성해야 한다.

- `singleton`이 `request` 의존을 사용할 때도 싱글톤 인스턴스는 재생성되지 않아야 한다.
  - `singleton` 생성 시점에 `request` 인스턴스를 생성하거나 캡처해서는 안 된다.
  - `request` 의존은 요청 컨텍스트(`RequestContextId`)가 존재하는 구간에서만 해석되어야 한다.

## MUST NOT

- 종료가 필요한 Provider를 누락된 dispose로 방치하는 것을 “정상”으로 취급해서는 안 된다.
- 클러스터/프로세스 모드에 따라 동일 Scope의 의미가 암묵적으로 바뀌어서는 안 된다. (변경이 있다면 cluster.spec.md에서 명시되어야 함)
- `request` 의존을 주입한다는 이유로 `singleton`을 재생성하는 동작을 허용해서는 안 된다.

## Handoff

- Provider 스코프의 ‘프로세스 경계’ 해석은 cluster.spec.md로 이관된다.

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

## Violation Conditions

- dispose가 필요한 Provider가 정의/판정되지 않거나, 종료 순서가 불명확한 경우
- scope가 모호하여 추측이 필요한 경우
- `singleton | request | transient` 의미를 위반하거나, `singleton` 재생성이 관측되는 경우

- `request` scope가 사용되는데, `RequestContextId`를 기준으로 판정할 수 없는 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
