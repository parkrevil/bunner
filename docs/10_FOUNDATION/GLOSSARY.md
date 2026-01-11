# Glossary (용어 사전)

Bunner 프로젝트에서 사용되는 주요 기술 용어와 도메인 개념의 SSOT 정의이다.

---

## 1. 아키텍처 개념 (Architecture Concepts)

- **Foundation**: 시스템이 동작하기 위한 최소한의 불변의 논리 및 기반 기술.
- **Contract (계약)**: 모듈 간 상호작용을 정의하는 인터페이스 및 제약 사항.
- **Invariants (불변식)**: 시스템의 생명주기 동안 항상 참이어야 하는 상태나 규칙.
- **Public Facade**: 외부 모듈에 노출되는 유일한 진입점 (`index.ts`).

- **Application (App)**: 부트스트랩이 완료된 런타임 애플리케이션 인스턴스.
- **App-External Code**: Application(App) 인스턴스 외부에서 실행되는 코드. (예: bootstrap 단계의 사용자 코드)

---

## 2. 모듈 및 의존성 (Modules & Dependencies)

- **AOT (Ahead-of-Time)**: 런타임 이전(빌드 또는 정적 분석 단계)에 수행되는 처리.
- **Facade Protection**: 내부 구현을 감추고 Facade를 통해서만 통신하게 강제하는 원칙.

- **Import Cycle (파일 import 순환)**: TypeScript/JavaScript의 모듈 import가 직접적 또는 간접적으로 순환을 이루는 상태.
  - import cycle은 런타임 로딩/초기화 순서를 모호하게 만들 수 있으므로, 빌드 실패로 판정되어야 한다.

- **DI Cycle (DI 그래프 순환)**: Provider/컴포넌트 의존 그래프가 순환 경로를 갖는 상태.
  - DI cycle은 빌드 타임에 탐지 가능해야 한다.
  - DI cycle이 존재하는 경우, 순환 경로에 최소 1개 이상의 lazy 의존(`inject(() => Token)` 형태)이 포함되어야 하며, 이를 만족하지 못하면 빌드 실패로 판정되어야 한다.

---

## 3. 엔지니어링 및 테스트 (Engineering & Testing)

- **SSOT (Single Source of Truth)**: 특정 정보나 규칙의 유일한 진본 문서.
- **Context Pollution (문맥 오염)**: 에이전트가 작업과 관련 없는 방대한 정보를 로드하여 판단력이 흐려지는 현상.
- **Reflections (리플렉션)**: 런타임에 객체의 메타데이터를 조회하거나 수정하는 행위. Bunner에서는 금지됨.

---

## 4. 거버넌스 (Governance)

- **Repository Hygiene (저장소 위생)**: 깨끗한 커밋 히스토리, 데드 코드 제거, 일관된 문서 구조를 유지하는 활동.
- **Persona (페르소나)**: 에이전트가 수행하는 특정 역할(Architect, Implementer, Reviewer).
