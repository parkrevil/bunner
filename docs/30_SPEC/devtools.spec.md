# DevTools Specification

L3 Implementation Contract
본 문서는 `DevTools`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 개발 중 모니터링/시각화 도구(DevTools)의 기능 경계 및 비개입(non-intrusive) 계약이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 DevTools가 관측/시각화/진단을 제공하면서 실행 의미론을 변경하지 않는 조건을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- MCP Server의 분석/변경 명령 표면 → mcp-server.spec.md에서 판정된다.
- 로깅 이벤트의 구조 → logger.spec.md에서 판정된다.

### 1.3 Definitions

- Non-intrusive: DevTools가 활성화되어도 실행 결과/경로/판정이 바뀌지 않는 성질.

---

## 2. Static Shape

Normative: 본 SPEC은 추가적인 Static Shape를 정의하지 않는다.

---

## 3. Invariants & Constraints

- DevTools는 관측 도구이며, 실행 경로를 재구성하는 지능을 포함하지 않는다.

### 3.1 MUST

- DevTools 활성화 여부에 따라 실행 의미론이 변하지 않아야 한다.

### 3.2 MUST NOT

- DevTools는 실행 경로를 변경하거나, 구조 판정을 대체해서는 안 된다.
- DevTools는 사용자의 코드/산출물을 암묵적으로 수정해서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- DevTools 활성화가 실행 결과/경로에 영향을 주는 경우
- Runtime Violation: DevTools가 데이터 소스를 런타임 스캔/추론으로 결정하는 것이 관측되는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
