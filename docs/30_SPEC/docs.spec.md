# API Documentation Specification (OpenAPI / AsyncAPI)

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 OpenAPI/AsyncAPI 등 API 명세 산출물의 생성 계약이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 API 명세 생성의 입력 소스(어댑터/DTO/에러/보안 등)와 산출물 정합성/결정성을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 명세를 표시하는 UI/DevTools → devtools.spec.md에서 판정된다.
- 문서 파일 배치/이름 → STRUCTURE.md 또는 manifest.spec.md의 산출물 섹션

## Definitions

- OpenAPI/AsyncAPI Artifact: 표준 스펙 포맷으로 생성되는 API 명세 산출물.
- Consistency: 실행 표면과 명세 산출물이 불일치하지 않는 성질.

## Invariants

- 명세 산출물은 빌드 타임에 생성 가능해야 하며(정적), 동일 입력에서 결정적으로 동일해야 한다.

## MUST

- API 명세는 adapter/execution/dto/error 모델과 정합해야 한다.
- API 명세 생성은 다음 입력을 사용할 수 있어야 한다:
  - 어댑터의 라우팅/이벤트 표면
  - DTO 스키마
  - 표준 오류 페이로드
  - 인증/인가 메타데이터(존재한다면)
- 명세 산출물은 동일 입력에서 결정적으로 동일해야 한다.
- 불일치가 검출되면 빌드 실패 또는 명시적 실패로 판정되어야 한다.

## MUST NOT

- 명세 산출물이 실행 표면과 불일치한 상태를 “정상”으로 허용해서는 안 된다.
- 런타임 관측만으로 명세를 생성하도록 요구해서는 안 된다.

## Handoff

- DTO 스키마는 dto.spec.md를 따른다.
- 오류 페이로드는 common.spec.md 및 error-handling.spec.md를 따른다.

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

## Violation Conditions

- 명세 생성 입력이 모호하여 추측이 필요한 경우
- 실행 표면과 명세가 불일치한데도 성공으로 판정되는 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
