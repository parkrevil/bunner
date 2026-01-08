# Manifest Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 Bunner가 빌드 타임에 생성/소비하는 Manifest(인덱스/그래프/계획)의 최소 계약을 정의한다.

## Scope & Boundary

본 SPEC은 구조 판정 결과를 담는 산출물의 불변 조건(immutability)과 생명주기(lifecycle)를 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- Manifest를 생성하기 위한 AST 판정 규칙 → aot-ast.spec.md에서 판정된다.
- Manifest를 기반으로 실행 흐름을 구성하는 의미론 → execution.spec.md에서 판정된다.

## Definitions

- Manifest: 빌드 타임에 확정된 구조 판정 결과(모듈/역할/DI/어댑터/실행계획 등)를 표현하는 산출물.
- Metadata Volatility: 구조 판정을 위해 사용된 메타데이터는 부트스트랩 이후 실행 경로에 영향을 미칠 수 없다는 원칙.

## Invariants

- Manifest는 빌드 산출물이며, 런타임이 구조를 “다시 판정”하기 위한 입력으로 사용되지 않는다.
- Manifest는 “실행 경로에 영향”을 주는 형태로 런타임에서 변형될 수 없다.

## MUST

- CLI는 구조 판정 결과를 Manifest 형태로 생성해야 한다.
- Manifest는 다음 정보를 표현할 수 있어야 한다: (상세 스키마는 ?????)
  - 모듈 트리/경계/가시성 판정 결과
  - 역할 식별(Decorator/표식 기반) 및 소속 관계
  - DI 그래프 및 wiring 정보
  - 어댑터 구성/연결/실행 계획(정상 실행 경로)
- Manifest는 동일 입력에서 결정적으로 동일해야 한다.
- Manifest는 실행(bootstrap) 이후 런타임의 경로 선택/구조 판정에 사용될 수 없도록, “Volatility” 제약을 만족해야 한다.

## MUST NOT

- Manifest에 런타임에서의 동적 판정을 요구하는 필드는 존재해서는 안 된다.
- Manifest가 런타임에서 수정/패치되어 실행 의미론을 변경해서는 안 된다.

## Handoff

- module-system.spec.md, di.spec.md, adapter.spec.md, execution.spec.md의 판정 결과는 Manifest의 대응 필드로 직렬화된다. (필드명/형식 ?????)
- docs.spec.md(OpenAPI/AsyncAPI) 산출물 생성은 Manifest를 입력으로 사용할 수 있다. (사용 여부/필수 여부 ?????)

## Violation Conditions

- Manifest가 생성되지 않았는데 빌드가 성공으로 판정되는 경우
- 동일 입력에서 Manifest가 다르게 생성되는 경우
- 런타임이 Manifest를 수정하거나, Manifest 수정이 실행 경로를 바꾸는 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
