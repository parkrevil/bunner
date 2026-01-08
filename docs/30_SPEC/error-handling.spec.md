# Error Handling Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 Failure(값 흐름)와 Panic(throw 경로)의 분리 및 Unified Error Filter Chain이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 throw로 발생하는 예외를 표준 결과(Result)로 변환하기 위한 Error Filter Chain의 계약을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 프로토콜별 최종 오류 표현(HTTP 상태 코드 등) → adapter.spec.md에서 판정된다.
- 정상 실행의 단계 구성 → execution.spec.md에서 판정된다.

## Definitions

- Failure: 도메인 실패로서 Result 경로(값 흐름)로 처리되는 실패.
- Panic(System Error): throw로 표현되는 시스템 오류.
- Error Filter Chain: throw된 예외를 포착하여 표준 결과로 변환하는 단일 체인.

## Invariants

- 사용자는 인프라 예외에 대해 수동 try-catch를 작성할 필요 없이, 프레임워크가 생성한 필터 체인을 통해 예외가 표준 Result로 변환됨을 보장받는다. (ROADMAP)

## MUST

- Failure와 Panic은 동일한 처리 경로로 합쳐지지 않아야 한다.
- throw로 발생한 예외는 Error Filter Chain을 통해 처리되어야 한다.
- Error Filter Chain은 체인 순서/우선순위가 판정 가능해야 한다. (구체 규칙 ?????)
- 필터 체인이 예외를 Result로 변환할 때 사용하는 표준 페이로드는 common.spec.md의 계약을 따른다.

## MUST NOT

- Failure를 throw로 표현하거나, Panic을 값 흐름으로 전달해서는 안 된다.
- 프로토콜 종속 정보(HTTP 상태 코드 등)를 도메인 에러 정의에 포함시켜서는 안 된다. (매핑은 어댑터에서 수행)
- 예외 처리에서 “추측 기반 분류”(문자열/메시지 파싱으로 Panic/Failure를 판정)를 허용해서는 안 된다.

## Handoff

- 최종 표현(상태 코드/프레임 등)은 adapter.spec.md로 이관된다.
- 로깅/관측 시 필수 필드는 logger.spec.md로 이관된다. (필수 필드 ?????)

## Violation Conditions

- 예외가 필터 체인을 거치지 않고 누락/삼켜지는 경우
- Failure/Panic 경계가 모호하여 추측이 필요한 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
