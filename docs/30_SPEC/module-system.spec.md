# `Module System` Specification

L3 Implementation Contract
본 문서는 `Module System`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 Bunner의 모듈 경계(Module Boundary)가 유효한 구현으로 판정되기 위한
정적 형상과 관측 가능한 행동의 최소 계약을 정의한다.

이 SPEC의 목적은 다음 2가지를 동시에 만족시키는 것이다.

- **Directory-First Modularity:** 모듈 경계는 디렉토리 구조로만 정의된다.
- **Explicitness Only:** 모듈 경계 판정은 추측이 아니라 파일 시스템 구조와 명시적 설정에만 근거한다.

### 1.2 Scope & Boundary

In-Scope (본 SPEC이 고정):

- 프로젝트 루트(Project Root) 판정의 최소 조건
- bunner config 기반의 **모듈 파일명** 판정
- 디렉토리 기반 모듈 루트 판정
- 모듈 이름/ID의 표준화 규칙
- “가장 가까운 상위 모듈로 귀속” 규칙

Out-of-Scope (타 SPEC으로 위임):

- 역할(Role) 식별(Decorator 기반 의미) → aot-ast.spec.md / common.spec.md
- 모듈 간 가시성/접근 장벽의 상세 규칙 → di.spec.md
- 실행 단위(Worker/Cron/Script) 식별 → execution.spec.md

---

## 2. Static Shape

본 섹션은 CLI, 정적 분석기, 코드 생성기가 참조하는 데이터 형상(Data Shape)만을 정의한다.

### 2.1 Core Data Shapes

Normative: 아래에 정의된 형상이 계약이다.

ModuleFileName:

- type: string
- meaning: 모듈 루트를 식별하는 파일명(해당 디렉토리 내부에 존재해야 함)

ProjectRootPath:

- type: string
- meaning: 프로젝트 루트를 나타내는 정규화된 경로

ModuleId:

- type: string
- meaning: 프로젝트 루트 기준 정규화된 상대 경로(Directory Identity)

ModuleName:

- type: string
- meaning: 모듈 루트 디렉토리의 basename

ModuleDescriptor:

- type: object
- required:
  - id
  - name
  - rootDir
  - file
- properties:
  - id: ModuleId
  - name: ModuleName
  - rootDir: string
  - file: string

### 2.2 bunner config (Resolved) Shape

본 SPEC은 bunner config 전체를 소유하지 않는다.
단, 모듈 판정에 필요한 최소 영역만을 계약으로 고정한다.

ResolvedBunnerConfigModule:

- type: object
- required:
  - fileName
- properties:
  - fileName:
    - type: string

### 2.3 Shape Conformance Rules

- `ResolvedBunnerConfigModule`은 위 형상과 정확히 일치해야 한다.
- `fileName`은 반드시 단일 파일명이어야 하며, 경로 구문(`/`, `..`)을 포함해서는 안 된다.

---

## 3. Invariants & Constraints

### 3.1 MUST

- 모듈의 경계는 디렉토리 구조로만 정의되어야 한다.
- 모듈 루트 판정은 반드시 bunner config에 의해 제공된 `fileName`만을 사용해야 한다.
- CLI는 어떤 파일명도 자동 추론해서는 안 된다.
- 동일한 입력(프로젝트 파일 시스템 + 동일한 resolved config)에서 모듈 판정 결과는 결정적으로 동일해야 한다.

### 3.2 MUST NOT

- 모듈 루트가 불명확하거나 판정 불가능한 경우, CLI는 추측으로 성공 처리해서는 안 된다.
- 런타임에서 모듈 경계를 재탐색/재판정하는 메커니즘은 존재해서는 안 된다.

---

## 4. Observable Semantics

### 4.1 Input / Observable Outcome

Input:

- 프로젝트 파일 시스템 트리
- 프로젝트 루트 경로
- resolved bunner config의 `module.fileName`

Observable:

- 어떤 디렉토리가 모듈 루트인지 결정되어야 한다.
- 모든 프레임워크-인식 대상 파일은 정확히 1개의 모듈에 귀속되어야 한다.
- 모듈 정의 파일이 없는 디렉토리의 구성 요소는 가장 가까운 상위 모듈로 귀속되어야 한다.

모듈 루트 판정 규칙(관측 가능한 결과로서의 규칙):

- 디렉토리 `D` 내부에 resolved `fileName`이 존재하면, `D`는 모듈 루트로 판정되어야 한다.
- 모듈 루트가 중첩되는 경우, 파일은 가장 가까운(가장 하위) 상위 모듈 루트에 귀속되어야 한다.

모듈 ID/이름 규칙(관측 가능한 결과로서의 규칙):

- 모듈 이름은 모듈 루트 디렉토리의 basename이어야 한다.
- 모듈 ID는 프로젝트 루트 기준 모듈 루트 디렉토리의 정규화된 상대 경로여야 한다.

### 4.2 State Conditions

- 판정은 빌드 타임에 완료되어야 하며, 런타임에서 구조 재판정이 관측되어서는 안 된다.

---

## 5. Violation Conditions

- Build-Time Violation: resolved bunner config에 `module.fileName`이 존재하지 않는 경우
- Build-Time Violation: `fileName`이 단일 파일명이 아니거나, 경로 구문(`/`, `..`)을 포함하는 경우
- Build-Time Violation: 단일 파일이 어떤 모듈에도 귀속되지 못하는 경우
- Test-Level Violation: 동일한 입력에서 서로 다른 모듈 판정 결과가 생성되는 경우

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

---

## 6. Handoff & Priority

### 6.1 Handoff

- 모듈 판정 결과는 manifest.spec.md에 정의된 필드로 직렬화되어야 한다.
- 모듈 경계의 가시성 장벽(외부 접근 차단)의 상세 규칙은 di.spec.md로 이관된다.

### 6.2 Layer Priority

본 문서는 L3 SPEC에 속한다.
L2 ARCHITECTURE 또는 L1 FOUNDATION과 충돌할 경우,
본 SPEC은 무효로 판정된다.
