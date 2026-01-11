# Adapter Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 프로토콜 격리 및 다중 어댑터 지원이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 Core가 프로토콜을 모르도록 유지하면서, 어댑터가 입출력/수명주기/최종 표현 책임을 가지는 계약을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 실행의 정상 흐름 의미론(Result/단계) → execution.spec.md에서 판정된다.
- 에러의 의미론(필터 체인, Failure/Panic) → error-handling.spec.md에서 판정된다.

## Definitions

- Adapter: 특정 프로토콜(HTTP/WS 등)의 입력을 표준 실행 모델로 연결하고, 결과를 프로토콜 표현으로 렌더링하는 계층.

## Invariants

- Core는 어댑터의 존재를 전제로 설계되어서는 안 된다. (L2 아키텍처 경계 전제)

## MUST

- 어댑터는 프로토콜 입력을 실행 모델로 전달할 수 있어야 한다.
- 어댑터는 Result/Failure/Panic을 프로토콜 표현으로 변환해야 한다. (매핑 규칙은 어댑터 소유)
- 어댑터의 정적 명세를 기반으로 Wiring 코드가 생성되어야 한다. (ROADMAP)

## MUST NOT

- 어댑터가 Core 내부 로직을 침범하여 구조 판정/추론을 수행해서는 안 된다.
- 어댑터 간 결합이 암묵적으로 발생해서는 안 된다.

## Handoff

- 어댑터의 정적 명세/산출물은 manifest.spec.md로 직렬화된다.
- 프로토콜별 문서(OpenAPI/AsyncAPI) 생성은 docs.spec.md로 이관된다.

## Violation Conditions

- 최종 표현 책임이 모호하거나, Core가 프로토콜 표현을 알게 되는 경우
- 어댑터 명세가 없어 추측 기반 wiring이 필요한 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
