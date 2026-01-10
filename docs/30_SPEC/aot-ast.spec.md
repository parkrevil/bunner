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

Out-of-Scope:

- 모듈 판정 규칙의 상세 → module-system.spec.md
- Manifest 산출물의 상세 형상 → manifest.spec.md

---

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

### 2.2 Shape Conformance Rules

- CLI가 최종적으로 취득하는 bunner config는 `ResolvedBunnerConfig`에 부합해야 한다.
- `ResolvedBunnerConfig.module`은 `ResolvedBunnerConfigModule`과 정확히 일치해야 한다.

---

## 3. Invariants & Constraints

### 3.1 MUST

- 구조적 사실(모듈 경계, 의존 관계, 역할)은 빌드 타임에 정적으로 확정되어야 한다.
- CLI는 bunner config를 빌드 타임에 로딩하여, AOT 판정의 입력으로 포함해야 한다.
- CLI는 모호함이 발견되면 추측하지 않고 빌드를 즉시 중단해야 한다.

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

Observable:

- CLI는 bunner config를 반드시 로딩해야 한다.
- bunner config가 존재하지 않으면, 빌드 실패가 관측되어야 한다.
- `bunner.config.ts`는 실행을 통해 resolved config object를 산출할 수 있어야 한다.
  - 해당 파일 내부의 조건문/환경변수 사용은 허용된다.
  - resolved 결과가 계약 형상(`ResolvedBunnerConfigModule`)을 위반하면 빌드 실패가 관측되어야 한다.

resolved config의 기본값 규칙:

- 사용자가 resolved config에 `module.fileName`을 제공하지 않은 경우, CLI는 기본값을 설정해야 한다.
- 기본값은 `"module.ts"`여야 한다.

결정성(determinism) 입력 정의:

- "동일 입력"은 최소한 다음을 포함해야 한다.
  - 프로젝트 파일 시스템의 동일 상태
  - bunner config 파일의 동일 상태
  - bunner config 실행에 영향을 주는 동일 조건(예: 환경변수)

### 4.2 State Conditions

- bunner config는 실행 이전에 확정되어야 한다.
- 런타임 중 bunner config 변경을 전제로 한 구조는 허용되지 않는다.

---

## 5. Violation Conditions

- Build-Time Violation: bunner config 파일이 존재하지 않는데 빌드가 성공하는 경우
- Build-Time Violation: resolved config에 `module.fileName`이 존재하지 않는데 빌드가 성공하는 경우
- Test-Level Violation: 동일 입력에서 AOT 판정 결과 또는 산출물이 비결정적으로 달라지는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- resolved bunner config의 `module` 섹션은 module-system.spec.md의 입력으로 사용되어야 한다.
- bunner config의 소스 정보 및 resolved module config는 manifest.spec.md의 `config` 필드로 기록되어야 한다.

### 6.2 Layer Priority

본 문서는 L3 SPEC에 속한다.
L2 ARCHITECTURE 또는 L1 FOUNDATION과 충돌할 경우,
본 SPEC은 무효로 판정된다.
