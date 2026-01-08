# Common Contracts Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 여러 기능 축에서 공유되는 공통 계약 타입/프로토콜을 정의한다.

## Scope & Boundary

본 SPEC은 Result/Failure/Panic, Context 식별자, 공통 에러 페이로드 등 ‘공유 타입’의 최소 계약을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 각 축의 의미론(예: 실행 단계, 에러 처리 체인) → 해당 SPEC(execution/error-handling 등)에서 판정된다.

## Definitions

- Result: 정상 흐름에서 사용되는 표준 결과 타입. 형태는 ????? (예: Result<T, E>).
- Failure: 도메인 실패(예측된 실패)로서 값 흐름으로 처리되는 실패.
- Panic(System Error): 시스템 불변식 위반/예측 불가 오류로서 throw 경로로 처리되는 오류.
- Structural Context: 실행 전/중에 전달되는 구조적 컨텍스트(식별자/트레이스 등). 구체 필드 ?????.

## Invariants

- 공통 타입은 프로토콜(HTTP/WS 등)에 종속되지 않는다.

## MUST

- Result/Failure/Panic을 구분할 수 있는 공통 계약이 존재해야 한다. (형식 ?????)
- 오류 페이로드(프로토콜 중립)는 최소 필드 집합을 가져야 한다. (필드 ?????)
- Structural Context의 최소 필드(예: correlation id 등)가 정의되어야 한다. (필드 ?????)

## MUST NOT

- 공통 계약이 특정 어댑터의 표현(상태 코드 등)에 종속되어서는 안 된다.
- Failure와 Panic을 동일 타입/동일 경로로 처리하게 설계해서는 안 된다.

## Handoff

- error-handling.spec.md는 Panic을 Failure(또는 Result)로 변환하는 허용/금지 규칙을 정의하며, 변환 대상 타입은 본 SPEC의 공통 계약을 따른다.
- logger.spec.md는 공통 Context 필드를 로그 구조에 반영한다. (필수 여부 ?????)

## Violation Conditions

- Failure/Panic 구분이 불가능하거나, 어댑터 표현에 종속되는 경우
- Structural Context가 정의되지 않아 실행/관측에서 추측이 필요한 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
