# AOT / AST Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 Bunner의 정적 분석(AOT) 및 AST 기반 판정이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 빌드 타임에서 수행되는 코드 해석/분석의 결정성(determinism)과 추측 금지 원칙을 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 생성 코드의 파일 배치/네이밍 → manifest.spec.md 또는 STRUCTURE.md에서 판정된다. (상세는 ?????)
- 프로토콜별 어댑터 표현(HTTP/WS/gRPC 등) → adapter.spec.md에서 판정된다.

## Definitions

- AOT(Compile-Time Intelligence): 런타임이 아니라 CLI/빌드 단계에서 판정/연결/코드 생성을 완료하는 모델.
- Determinism: 동일한 입력(레포 상태/설정/옵션)에 대해 동일한 판정 및 산출물이 생성되는 성질.

## Invariants

- 구조적 모호함이 발견되면 추측하지 않고 빌드를 즉시 중단한다. (FOUNDATION/INVARIANTS의 “Explicitness Over Guesses” 전제)
- 런타임은 구조를 판정하거나 추론하지 않는다. (빌드 타임에 판정 완료)

## MUST

- CLI는 프로젝트 구조 판정(모듈/역할/가시성/DI 연결 등)을 빌드 타임에 완결해야 한다.
- 동일 입력에서 판정 결과와 산출물(매니페스트/코드젠)이 결정적으로 동일해야 한다.
- 정적 판정에 필요한 정보(역할/경계/연결)는 명시적으로 제공되어야 하며, 누락 시 빌드 실패로 판정해야 한다.
- 순환 참조/순환 의존이 발견되면 빌드를 즉시 중단하고, 순환 경로를 출력해야 한다. (표현 포맷은 ?????)

## MUST NOT

- CLI는 모호한 구조를 “보정”하거나 “추측 기반”으로 자동 해결해서는 안 된다.
- 런타임 리플렉션/동적 탐색으로 빌드 타임 판정을 대체해서는 안 된다.
- CLI는 사용자 함수의 본문을 재작성하지 않는다. (ROADMAP의 code generation boundary 전제; 예외가 있다면 ?????)

## Handoff

- 정적 판정 결과는 manifest.spec.md에서 정의되는 산출물 형태로 외부에 노출된다.
- 역할/경계 판정의 입력(표식/메타데이터)의 구체 형태는 module-system.spec.md 및 common.spec.md로 이관된다. (세부 포맷 ?????)

## Violation Conditions

- 구조 판정에 필요한 정보가 누락/모호하여 추측이 필요해지는 경우
- 동일 입력에서 산출물이 비결정적으로 달라지는 경우
- 순환 참조가 검출되었는데도 빌드가 성공으로 판정되는 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
