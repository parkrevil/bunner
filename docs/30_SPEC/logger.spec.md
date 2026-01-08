# Logger & Observability Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 로깅/관측이 ‘실패 이해 가능성’을 충족하기 위해 제공해야 하는 최소 계약을 정의한다.

## Scope & Boundary

본 SPEC은 구조적 로그, 상관관계(Context), 에러 리포팅의 최소 필드를 판정 가능한 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 로그 저장소/전송/백엔드 선택 → 구현 세부이며 본 SPEC 범위 밖이다. (구체로 고정할 경우 ?????)
- 프로토콜별 오류 표현 → adapter.spec.md에서 판정된다.

## Definitions

- Structured Log: 키-값 기반으로 파싱 가능한 로그 이벤트.
- Correlation: 하나의 요청/작업/실행 흐름을 연결하는 식별자/컨텍스트.

## Invariants

- 실패는 이해 가능한 형태로 관측 가능해야 한다. (VISION)

## MUST

- 로그 이벤트는 구조화된 형태로 표현될 수 있어야 한다. (필수 필드 집합 ?????)
- 실행 컨텍스트(Structural Context)와 로그 이벤트가 연결되어야 한다. (필드 ?????)
- Panic(System Error) 및 Failure는 로그에서 구분 가능해야 한다.
- 에러 리포팅은 표준화된 형식을 가져야 한다. (형식 ?????)

## MUST NOT

- 로그가 실행 의미론을 변경하도록(예: 로깅 실패로 요청 실패) 설계해서는 안 된다. (예외 ?????)
- 상관관계가 없어서 원인 추적이 불가능한 수준의 관측성을 “정상”으로 취급해서는 안 된다.

## Handoff

- common.spec.md의 Structural Context 필드는 로깅 필드와 정합해야 한다. (정합 규칙 ?????)
- error-handling.spec.md의 Error Filter Chain 처리 결과는 로깅 표준에 따라 기록될 수 있다. (필수 여부 ?????)

## Violation Conditions

- Panic/Failure 구분이 관측 불가능한 경우
- 컨텍스트가 연결되지 않아 추적이 불가능한 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
