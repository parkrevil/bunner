# ORM Integration Specification (Drizzle)

L3 Implementation Contract
본 문서는 `ORM Integration (Drizzle)`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 ORM(Drizzle) 연동 기능이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 ORM 연동의 경계, 코드 생성/스키마 연계, 실행/DI/Provider와의 접점을 판정 가능한 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 특정 ORM의 API 상세 사용법 → 가이드/레퍼런스 문서 범위다.

### 1.3 Definitions

Normative: 본 SPEC은 추가적인 용어 정의를 도입하지 않는다.

---

## 2. Static Shape

Normative: 본 SPEC은 추가적인 Static Shape를 정의하지 않는다.

---

## 3. Invariants & Constraints

- 연동은 빌드 타임 판정(정적 산출물) 원칙을 침범하지 않는다.

### 3.1 MUST

- ORM 연동은 빌드 타임 판정(정적 산출물) 원칙을 침범해서는 안 된다.

### 3.2 MUST NOT

- 런타임 리플렉션/동적 스캔으로 ORM 모델을 판정하도록 요구해서는 안 된다.
- ORM 연동이 Core 아키텍처 경계를 침범하여 프로토콜/어댑터에 종속되어서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- Build-Time Violation: 연동에 필요한 메타데이터가 누락되었는데도 연동이 성공으로 판정되는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- DI/Provider 결합은 di.spec.md 및 provider.spec.md를 따른다.

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
