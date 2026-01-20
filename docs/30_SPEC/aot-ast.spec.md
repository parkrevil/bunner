# `AOT / AST` Specification

L3 Implementation Contract
본 문서는 `AOT / AST`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 Bunner CLI가 빌드 타임에 수행하는 정적 분석(AOT) 및 AST 기반 판정이
유효한 구현으로 성립하기 위한 최소 계약을 정의한다.

이 SPEC은 특히 bunner config 로딩/해석이 AOT 판정의 입력으로 포함되는 경우,
"무엇이 입력이며 무엇이 사용자 책임인가"의 경계를 명시한다.

### 1.2 Scope & Boundary

In-Scope:

- 프로젝트 루트 판정의 최소 조건(구성 파일 로딩을 위한 전제)
- bunner config 파일의 강제 로딩 규칙(`bunner.config.ts` 또는 `bunner.config.json`)
- bunner config의 실행/해석 결과(resolved object)의 최소 계약
- AOT 판정의 결정성 입력 정의(동일 입력의 의미)
- 산출물 루트 디렉토리의 고정 위치

Out-of-Scope:

- 모듈 판정 규칙의 상세 → module-system.spec.md
- Manifest 산출물의 상세 형상 → manifest.spec.md
- 모듈 루트 파일의 어댑터 구성 선언 계약 → module-system.spec.md

- 산출물의 파일 경로/파일명/디렉토리 분할 규칙
  - 산출물의 경로/이름을 계약으로 고정하는 것
  - 단, 산출물 루트 디렉토리는 본 SPEC에서 고정한다.

### 1.3 Definitions

Normative: 본 SPEC은 추가적인 용어 정의를 도입하지 않는다.

## 2. Static Shape

### 2.1 Core Data Shapes

BunnerConfigSourceFormat:

- type: string
- allowed values:
  - ts
  - json

BunnerConfigSource:

- type: object
- required:
  - path
  - format
- properties:
  - path:
    - type: string
    - meaning: 프로젝트 루트 기준 상대 경로
  - format: BunnerConfigSourceFormat

ResolvedBunnerConfigModule:

- type: object
- required:
  - fileName
- properties:
  - fileName:
    - type: string

ResolvedBunnerConfig:

- type: object
- required:
  - module
- properties:
  - module: ResolvedBunnerConfigModule

BuildProfile:

- type: string
- allowed values:
  - minimal
  - standard
  - full

### 2.2 Shape Conformance Rules

- CLI가 최종적으로 취득하는 bunner config는 `ResolvedBunnerConfig`에 부합해야 한다.
- `ResolvedBunnerConfig.module`은 `ResolvedBunnerConfigModule`과 정확히 일치해야 한다.

---

## 3. Invariants & Constraints

### 3.1 MUST

- 구조적 사실(모듈 경계, 의존 관계, 역할)은 빌드 타임에 정적으로 확정되어야 한다.
- CLI는 bunner config를 빌드 타임에 로딩하여, AOT 판정의 입력으로 포함해야 한다.
- CLI는 모호함이 발견되면 추측하지 않고 빌드를 즉시 중단해야 한다.
- Build profile은 BuildProfile로 판정 가능해야 한다.
- Build profile은 빌드 호출 입력에 의해 명시될 수 있어야 한다.
- Build profile이 빌드 호출 입력에 의해 명시된 경우, 해당 값은 우선 적용되어야 한다.
- Build profile minimal은 Manifest만 생성해야 한다.
- Build profile standard는 Manifest와 Interface Catalog를 생성해야 한다.
- Build profile full은 Manifest, Interface Catalog, Runtime Observation Artifact를 생성해야 한다.

### 3.2 MUST NOT

- 런타임은 구조를 판정하거나 추론해서는 안 된다.
- CLI는 사용자 함수의 본문을 재작성해서는 안 된다.

---

## 4. Observable Semantics

### 4.1 Input / Observable Outcome

Input:

- 프로젝트 파일 시스템 트리
- 프로젝트 루트 디렉토리
- bunner config 소스(`bunner.config.ts` 또는 `bunner.config.json`)
- 빌드 호출 입력(선택): build profile 선택
- 모듈 루트 파일 집합 (module-system.spec.md로 판정된 모듈 파일)

Observable:

- CLI는 bunner config를 반드시 로딩해야 한다.
- bunner config가 존재하지 않으면, 빌드 실패가 관측되어야 한다.
- `bunner.config.ts`는 실행을 통해 resolved config object를 산출할 수 있어야 한다.
  - 해당 파일 내부의 조건문/환경변수 사용은 허용된다.
  - resolved 결과가 계약 형상(`ResolvedBunnerConfigModule`)을 위반하면 빌드 실패가 관측되어야 한다.

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

resolved config의 필수 규칙:

- resolved bunner config는 `module.fileName`을 반드시 포함해야 한다.
- CLI는 `module.fileName`에 대해 어떠한 기본값도 설정해서는 안 된다.

- 산출물 디렉토리는 `<PROJECT_ROOT>/.bunner`로 고정되어야 한다.

결정성(determinism) 입력 정의:

- "동일 입력"은 최소한 다음을 포함해야 한다.
  - 프로젝트 파일 시스템의 동일 상태
  - resolved bunner config의 동일 상태
  - effective build profile의 동일 상태

- bunner config 소스가 환경변수 등을 사용하더라도, 결정성 입력은 resolved bunner config를 기준으로 판정되어야 한다.

정적 해석 범위:

- CLI는 프로젝트 소스가 참조하는 심볼을 따라가며, 정적 해석을 수행할 수 있어야 한다.
- 이 정적 해석은 `node_modules` 하위 파일을 포함할 수 있다.
- CLI는 `node_modules` 전수 스캔을 수행해서는 안 된다.

### 4.2 State Conditions

- bunner config는 실행 이전에 확정되어야 한다.
- 런타임 중 bunner config 변경을 전제로 한 구조는 허용되지 않는다.

---

## 5. Violation Conditions

- Build-Time Violation: bunner config 파일이 존재하지 않는데 빌드가 성공하는 경우
- Build-Time Violation: resolved config에 `module.fileName`이 존재하지 않는데 빌드가 성공하는 경우
- Build-Time Violation: resolved config가 계약 형상(`ResolvedBunnerConfigModule`)을 위반하는 경우
- Build-Time Violation: effective build profile이 BuildProfile 허용값을 위반하는데도 빌드가 성공하는 경우
- Test-Level Violation: 동일 입력에서 AOT 판정 결과 또는 산출물이 비결정적으로 달라지는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- resolved bunner config의 `module` 섹션은 module-system.spec.md의 입력으로 사용되어야 한다.
- bunner config의 소스 정보 및 resolved module config는 manifest.spec.md의 `config` 필드로 기록되어야 한다.

- 모듈 루트 파일의 어댑터 구성 선언의 판정 및 형상 검증은 module-system.spec.md로 이관된다.

### 6.2 Layer Priority

본 문서는 L3 SPEC에 속한다.
L2 ARCHITECTURE 또는 L1 FOUNDATION과 충돌할 경우,
상위 문서가 우선한다.
