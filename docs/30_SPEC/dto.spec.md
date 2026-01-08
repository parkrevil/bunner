# DTO & Schema Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 DTO 정의와 스키마 기반 변환/검증이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 DTO(전송 객체)와 변환/검증(Transformer/Validator)의 통합 계약을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 프로토콜별 직렬화 표현 → adapter.spec.md에서 판정된다. (단, 공통 스키마/타입은 본 SPEC 소유)
- OpenAPI/AsyncAPI 산출물 생성 → docs.spec.md에서 판정된다.

## Definitions

- DTO: 데이터 전송 객체. 비즈니스 로직을 포함하지 않는 구조적 데이터.
- Schema: DTO의 구조를 나타내는 정적 명세. (표현 방식 ?????)
- Transformer: DTO 변환 규칙. “제로 오버헤드” 목표(ROADMAP/기존 문서)와의 정합 조건 ?????.
- Validator: DTO 검증 규칙. “제로 디펜던시” 목표와의 정합 조건 ?????.

## Invariants

- DTO/Schema는 빌드 타임에서 판정 가능해야 하며, 런타임 추론에 의존하지 않는다.

## MUST

- DTO는 스키마로 정의 가능해야 한다. (정의 방법 ?????)
- 변환/검증은 DTO 스키마를 기반으로 수행되어야 한다.
- 비즈니스 진입 전 검증 완료(Validation Before Business) 원칙이 적용되어야 한다. (적용 범위 ?????)

## MUST NOT

- DTO에 프로토콜 종속 정보(상태 코드 등)를 포함시키지 않는다.
- 변환/검증을 런타임 리플렉션으로 수행하도록 요구해서는 안 된다.

## Handoff

- docs.spec.md는 DTO 스키마를 입력으로 OpenAPI/AsyncAPI 산출물을 생성할 수 있다. (필수/선택 ?????)
- execution.spec.md는 DTO 검증 실패를 Failure로 취급하는 규칙을 참조한다. (정확한 Failure 형태 ?????)

## Violation Conditions

- DTO 구조가 스키마로 판정되지 않아 추측이 필요한 경우
- 검증 실패가 Panic으로 처리되거나, 경계가 모호한 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
