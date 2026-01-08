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

## MUST

- DI 그래프는 Manifest 기반으로 정적으로 구성되어야 한다.
- 순환 의존이 발견되면 빌드를 중단하고 순환 경로를 출력해야 한다. (표현 포맷 ?????)
- DI 해석 결과는 런타임에서 동적으로 변경될 수 없다.

## MUST NOT

- 런타임에서 반사(reflection) 또는 컨테이너 자동 스캔으로 의존을 해결해서는 안 된다.
- “없는 의존은 null/undefined로 주입” 같은 묵시적 완화를 허용해서는 안 된다.

## Handoff

- 그래프의 노드(Provider/Component/Factory 등)의 생명주기 의미론은 provider.spec.md로 이관된다.
- Wiring 산출물의 형식은 manifest.spec.md로 이관된다.

## Violation Conditions

- 순환 의존이 존재하는데도 빌드가 성공하는 경우
- 런타임에서 DI 연결이 변경되는 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
