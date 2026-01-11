# FFI Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 Rust FFI 기반 확장/어댑터 코어가 구현 대상일 때, 안전/경계/호출 규약이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 FFI 경계에서의 안정성, 호출 규약, 실패 모델을 판정 가능한 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 구체 ABI/언어별 튜토리얼 → 가이드 문서 범위다.

## Definitions

- FFI Boundary: JS/Bun 런타임과 네이티브(Rust) 사이의 호출 경계.
- Safety: 메모리/리소스/오류 전파가 정의된 계약을 따르는 성질.

## Invariants

- FFI는 Engine/Runtime 불변식(Bun only, build-time intelligence)을 침범하지 않는다.

## MUST

## MUST NOT

- FFI 오류를 메시지 파싱 등 추측으로 분류해서는 안 된다.
- 메모리/리소스 소유권이 불명확한 호출 형태를 허용해서는 안 된다.

## Handoff

- 오류 모델은 common.spec.md 및 error-handling.spec.md를 따른다.

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

## Violation Conditions

- 소유권/호출 규약이 불명확하여 추측이 필요한 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
