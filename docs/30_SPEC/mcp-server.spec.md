# MCP Server Specification

L3 Implementation Contract
본 문서는 `MCP Server`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 MCP Server가 사용자 바이브코딩을 지원하기 위해 제공하는 기능 표면 및 안전 계약이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 MCP Server의 명령/도구 표면, 변경 안전성, 결정성, 실패 모델을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- DevTools(모니터링/시각화) 제품 표면 → devtools.spec.md에서 판정된다.
- 프로젝트 구조/모듈 판정 자체 → module-system.spec.md 및 aot-ast.spec.md에서 판정된다.

### 1.3 Definitions

Normative: 본 SPEC은 추가적인 용어 정의를 도입하지 않는다.

---

## 2. Static Shape

Normative: 본 SPEC은 추가적인 Static Shape를 정의하지 않는다.

---

## 3. Invariants & Constraints

- 구조적 모호함이 발견되면 추측하지 않고 중단한다. (AGENTS/FOUNDATION 전제)
- 동일 입력에서 동일 결과(결정성)를 유지해야 한다. (AOT/Manifest 전제)

### 3.1 MUST

- 변경 작업은 “무엇을 바꾸는지”가 판정 가능해야 한다.
- MCP Server의 작업 결과는 재현 가능해야 한다. (동일 입력→동일 diff/산출물)

### 3.2 MUST NOT

- MCP Server는 불확실한 상태에서 임의로 코드를 수정해서는 안 된다.
- 상위 SSOT 문서(L1/L2)를 자동 수정하는 기능을 기본 경로로 제공해서는 안 된다.
- 네트워크/외부 자원 접근 등 비결정적 부작용을 전제로 설계해서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- Build-Time Violation: 서버가 제공하는 명령/도구 표면이 명시되지 않았는데도 서버가 시작/등록에 성공하는 경우
- Test-Level Violation: 동일 입력에서 변경 작업 결과(diff/산출물)가 비결정적으로 달라지는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- 구조 판정은 aot-ast.spec.md 및 module-system.spec.md를 따른다.
- 산출물(Manifest 등)은 manifest.spec.md를 따른다.

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
