# Execution Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 Bunner의 정상 실행(정상 경로) 의미론과 Result 기반 흐름이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 Middleware → Guard → Handler로 이어지는 정상 실행 흐름(ROADMAP의 실행 흐름)을 판정 가능한 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- throw로 발생한 예외의 처리(필터 체인) → error-handling.spec.md에서 판정된다.
- 프로토콜별 입출력 표현 → adapter.spec.md에서 판정된다.

## Definitions

- Normal Path: 예외(throw)가 발생하지 않는 실행 경로.
- Handler: 어댑터가 최종적으로 호출하는 사용자 함수(요청 처리 엔트리).
- Middleware/Guard: 실행 흐름을 구성하는 전/중간 단계 구성요소. 구체 역할 정의 ?????.

## Invariants

- 정상 실행은 Result(또는 공통 결과 계약)에 의해 표현된다.
- 실행 흐름은 어댑터 개발자가 직관적으로 구성할 수 있는 모델이어야 한다. (ROADMAP)

## MUST

- 정상 실행은 Result 기반 흐름으로 표현되어야 한다. (Result 형태는 common.spec.md에 의해 정의된다)
- 실행 흐름은 최소한 `Middleware -> Guard -> Handler`의 순서를 표현할 수 있어야 한다. (세부 단계/확장 ?????)
- Structural Context Propagation이 지원되어야 한다. (필수 필드/전달 규칙 ?????)
- 런타임 구성 요소는 빌드 타임에 확정된 정적 연결 관계만을 따른다. (ARCHITECTURE의 Static Context Binding 전제)

## MUST NOT

- 정상 실행 흐름을 런타임에서 동적으로 재구성하거나, 구조를 추론해서는 안 된다.
- 사용자 함수 본문을 재작성하여 실행 의미론을 강제해서는 안 된다. (예외가 있다면 ?????)

## Handoff

- throw가 발생하면 정상 실행은 즉시 이탈하며, 예외는 error-handling.spec.md의 Unified Error Filter Chain으로 이관된다.
- 실행 구성(어댑터별 wiring/초기화)은 adapter.spec.md 및 manifest.spec.md로 이관된다.

## Violation Conditions

- Result 기반 정상 흐름이 아닌데도 “정상”으로 판정되는 경우
- 실행 단계/컨텍스트 전달이 모호하여 추측이 필요한 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
