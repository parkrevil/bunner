# ORM Integration Specification (Drizzle)

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 ORM(Drizzle) 연동 기능이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 ORM 연동의 경계, 코드 생성/스키마 연계, 실행/DI/Provider와의 접점을 판정 가능한 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 특정 ORM의 API 상세 사용법 → 가이드/레퍼런스 문서 범위다. (해당 문서 ?????)

## Definitions

- ORM Integration: 데이터 계층을 프레임워크 구조/DI/Provider 모델에 연결하는 기능.
- Codegen: ORM 스키마로부터 생성되는 보조 코드/타입. 구체 형태 ?????.

## Invariants

- 연동은 빌드 타임 판정(정적 산출물) 원칙을 침범하지 않는다.

## MUST

- ORM 연동은 DI/Provider 모델과 결합 가능해야 한다. (결합 방식 ?????)
- ORM 스키마/타입 정보가 DTO/Schema 및 문서화(docs) 산출물과 정합 가능해야 한다. (정합 규칙 ?????)
- 코드 생성이 포함된다면, 생성 경계(사용자 본문 재작성 금지)를 준수해야 한다. (예외 ?????)

## MUST NOT

- 런타임 리플렉션/동적 스캔으로 ORM 모델을 판정하도록 요구해서는 안 된다.
- ORM 연동이 Core 아키텍처 경계를 침범하여 프로토콜/어댑터에 종속되어서는 안 된다.

## Handoff

- DI/Provider 결합은 di.spec.md 및 provider.spec.md를 따른다.
- 산출물은 manifest.spec.md 및 (필요 시) docs.spec.md로 이관된다. (구체 ?????)

## Violation Conditions

- 연동에 필요한 메타가 부족해 추측 기반 자동 설정이 필요한 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
