# Module System Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 디렉토리 기반 모듈 발견, 모듈 경계 및 역할 식별의 유효 조건을 정의한다.

## Scope & Boundary

본 SPEC은 프로젝트 구조(Discovery)와 모듈 경계(Directory-First)를 판정 가능한 규칙으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 코드 스타일/네이밍 규칙 → STYLEGUIDE.md에서 판정된다.
- 파일/디렉토리 배치의 SSOT → STRUCTURE.md에서 판정된다.

## Definitions

- Module Boundary (Directory-First): 디렉토리 단위로 모듈 경계를 형성하며, 경계는 자동 추론이 아니라 명시 규칙으로 판정된다.
- Role Identification: Decorator/표식 및 Manifest 기반으로 구성요소의 역할을 식별하는 모델.
- Independent Unit: Cron/Worker/Script 등 독립 실행 단위로 취급되는 엔트리.

## Invariants

- 구조적 모호함(경계/역할/소속)이 발견되면 추측하지 않고 빌드를 중단한다.
- 런타임에서 모듈/역할을 탐색하여 판정하지 않는다.

## MUST

- 모듈 경계는 디렉토리 우선 규칙에 따라 판정되어야 한다. (구체 규칙 ?????)
- 역할 식별은 Decorator/표식 및 Manifest 기반으로 판정되어야 한다. (표식 종류/필수 메타 ?????)
- Cron/Worker/Script 같은 독립 실행 단위는 프로젝트 구조에서 식별 가능해야 한다. (식별 규칙 ?????)
- Discovery 단계에서 실패 모델(누락/충돌/중복)이 표준화되어야 한다. (에러 코드/포맷 ?????)

## MUST NOT

- 디렉토리 구조가 모호한 경우, CLI가 관대한 기본값으로 추측하여 자동 구성해서는 안 된다.
- 역할/소속을 코드 본문 분석으로 “추정”해서는 안 된다. (명시 정보 누락 시 실패)

## Handoff

- 모듈/역할 판정 결과는 manifest.spec.md로 직렬화된다.
- DI 연결에 필요한 가시성/내부 공개 범위는 di.spec.md로 이관된다. (세부 ?????)

## Violation Conditions

- 경계/역할을 판정할 수 없는데도 빌드가 성공하는 경우
- 동일 입력에서 모듈 트리가 다르게 판정되는 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
