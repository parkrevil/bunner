# `Manifest` Specification

L3 Implementation Contract
본 문서는 `Manifest`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 Bunner CLI가 빌드 타임에 생성하는 Manifest 산출물이
유효한 구현으로 판정되기 위한 형상과 관측 가능한 행동의 최소 계약을 정의한다.

### 1.2 Scope & Boundary

In-Scope:

- Manifest의 최소 형상(스키마 버전 포함)
- 모듈 판정 결과를 Manifest에 직렬화하는 최소 필드
- bunner config의 **resolved 결과** 중 모듈 판정에 필요한 최소 필드의 기록
- 결정성(determinism) 및 불변성(immutability) 제약

Out-of-Scope:

- 역할/DI/어댑터/실행계획의 상세 스키마 → 각 대응 SPEC
- 부트스트랩 이후 메타데이터 소거의 구체 타이밍/방식 → execution.spec.md
- 런타임 관측 산출물(Runtime Report) 형상 → devtools.spec.md

### 1.3 Definitions

Normative: 본 SPEC은 추가적인 용어 정의를 도입하지 않는다.

---

## 2. Static Shape

### 2.1 Core Data Shapes

ManifestSchemaVersion:

- type: string
- const: "1"

ManifestConfigSourceFormat:

- type: string
- allowed values:
  - ts
  - json

ManifestResolvedModuleConfig:

- type: object
- required:
  - fileName
- properties:
  - fileName:
    - type: string

ManifestConfig:

- type: object
- required:
  - sourcePath
  - sourceFormat
  - resolvedModuleConfig
- properties:
  - sourcePath:
    - type: string
    - meaning: 프로젝트 루트 기준 bunner config 상대 경로
  - sourceFormat: ManifestConfigSourceFormat
  - resolvedModuleConfig: ManifestResolvedModuleConfig

ManifestModule:

- type: object
- required:
  - id
  - name
  - rootDir
  - file
- properties:
  - id:
    - type: string
  - name:
    - type: string
  - rootDir:
    - type: string
  - file:
    - type: string

BunnerManifest:

- type: object
- required:
  - schemaVersion
  - config
  - modules
- properties:
  - schemaVersion: ManifestSchemaVersion
  - config: ManifestConfig
  - modules:
    - type: array
    - items: ManifestModule

### 2.2 Shape Conformance Rules

- Manifest 파일은 `BunnerManifest`와 정확히 일치해야 한다.
- `modules` 배열은 반드시 결정적 순서를 가져야 한다.
  - 정렬 키는 `id`의 오름차순이어야 한다.

---

## 3. Invariants & Constraints

### 3.1 MUST

- CLI는 빌드 타임에 Manifest를 생성해야 한다.
- Manifest는 동일 입력(프로젝트 파일 시스템 + 동일한 resolved config)에서 결정적으로 동일해야 한다.
- Manifest의 `modules`는 `id` 오름차순으로 정렬되어야 한다.
- Manifest는 런타임에서 수정될 수 없어야 한다.
- Manifest는 모듈 판정 결과를 module-system.spec.md와 모순 없이 표현해야 한다.

### 3.2 MUST NOT

- Manifest는 런타임 동적 판정을 요구하는 필드를 포함해서는 안 된다.

- Manifest는 런타임 상태(어댑터 활성화 여부, listening 여부, 실제 바인딩 결과, host/port 및 런타임 옵션 값)를 포함해서는 안 된다.

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

---

## 4. Observable Semantics

### 4.1 Input / Observable Outcome

Input:

- 프로젝트 파일 시스템 트리
- resolved bunner config
- module-system.spec.md의 규칙에 의해 판정된 모듈 목록

Observable:

- Manifest는 반드시 생성되어야 한다.
- Manifest의 `config.resolvedModuleConfig.fileName`은 resolved bunner config와 동일해야 한다.
- Manifest의 `modules`는 모듈 판정 결과와 동일한 모듈 집합을 표현해야 한다.

### 4.2 State Conditions

- 런타임은 구조를 재판정하기 위한 목적으로 Manifest를 사용해서는 안 된다.

---

## 5. Violation Conditions

- Build-Time Violation: Manifest가 생성되지 않았는데 빌드가 성공으로 판정되는 경우
- Test-Level Violation: 동일 입력에서 서로 다른 Manifest가 생성되는 경우
- Build-Time Violation: `modules` 배열이 `id` 오름차순 결정적 정렬을 따르지 않는 경우
- Runtime Violation: 런타임에서 Manifest 수정이 관측되거나, 수정이 실행 경로를 변경하는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- module-system.spec.md의 모듈 판정 결과는 `BunnerManifest.modules`로 직렬화되어야 한다.
- bunner config 로딩 규칙은 aot-ast.spec.md가 정의하며, 그 결과는 `BunnerManifest.config`로 기록되어야 한다.

### 6.2 Layer Priority

본 문서는 L3 SPEC에 속한다.
L2 ARCHITECTURE 또는 L1 FOUNDATION과 충돌할 경우,
상위 문서가 우선한다.
