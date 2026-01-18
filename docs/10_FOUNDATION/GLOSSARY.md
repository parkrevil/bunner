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

- **Entry Module**: Application(App)을 구성하기 위한 시작점으로 지정되는 단일 모듈 참조이다.

- **app.attachAdapter**: App-External Code에서 특정 AdapterId에 대한 런타임 옵션을 바인딩하고, 해당 어댑터를 실행 준비 상태로 전이시키는 App 조작이다.

- **Adapter Activation**: App 실행 중 특정 어댑터가 실제로 활성화(적용)되어 실행 경로를 생성할 수 있는 상태가 되는 것을 의미한다.
- **Adapter Option Binding**: 특정 어댑터의 구조(정적 그래프)를 변경하지 않고, host/port 같은 런타임 옵션 값을 연결하는 행위다.

- **Runtime Report**: 런타임에서 관측되는 실행 사실(어댑터 활성화/리스닝/바인딩/옵션 값 등)을 기록한 산출물이다.

- **DevTools Static Graph**: 빌드 타임에 수집된 정적 그래프(바인딩 후보 포함)를 기록한 DevTools 입력 산출물이다.

- **createApplication**: App 인스턴스를 생성하는 부트스트랩 진입점이다.
- **app.start**: App을 실행 상태로 전이시키는 실행 진입점이다.
- **app.stop**: App을 종료 상태로 전이시키는 종료 진입점이다.
- **app.get(Token)**: App-External Code에서 singleton/all Provider 인스턴스에 접근하기 위한 진입점이다.

- **defineConfig**: Config Section을 등록하기 위한 App-External Code의 등록 호출 식별자이다.

- **isAttached**: DevTools runtime report에서 특정 어댑터의 옵션 바인딩(attach)이 완료되었음을 나타내는 상태 값이다.
- **isRunning**: DevTools runtime report에서 특정 어댑터가 실행 상태에 진입했음을 나타내는 상태 값이다.

- **onModuleInit**: `@Injectable()` Provider 초기화 시점에 호출되는 애플리케이션 생명주기 훅 메서드명이다.
- **onModuleDestroy**: `@Injectable()` Provider 종료(dispose) 시점에 호출되는 애플리케이션 생명주기 훅 메서드명이다.
- **onApplicationBootstrap**: 애플리케이션 부트스트랩 완료 시점에 호출되는 애플리케이션 생명주기 훅 메서드명이다.
- **beforeApplicationShutdown**: 애플리케이션 종료 직전에 호출되는 애플리케이션 생명주기 훅 메서드명이다.
- **onApplicationShutdown**: 애플리케이션 종료 완료 시점에 호출되는 애플리케이션 생명주기 훅 메서드명이다.

- **Adapter**: 특정 프로토콜(HTTP/WS 등)의 입력을 표준 실행 모델로 연결하고, 결과를 프로토콜 표현으로 렌더링하는 계층이다.

- **Core**: 프로토콜을 인지하지 않는 비즈니스 로직 계층이다. Core는 프로토콜 종속 입력/출력 표현을 전제로 하지 않으며, 어댑터 경계를 통해서만 프로토콜과 결합된다.
- **Engine**: 프레임워크의 핵심 실행 엔진이다. Engine은 빌드 타임에 확정된 정적 연결(wiring)에 의해 실행 경로가 고정되며, 런타임에 사용자에 의해 교체·후킹·변형될 수 없다.

- **ContextId**: 요청 컨텍스트를 식별하기 위한 정적 동일성 값이다.
- **AdapterId**: 어댑터를 식별하기 위한 정적 동일성 값이다.
- **HandlerId**: 핸들러를 결정적으로 식별하기 위한 문자열이다. (형식/규칙은 diagnostics.spec.md의 HandlerId 계약을 따른다)
- **ModuleId**: 모듈을 식별하기 위한 정적 동일성 값이다.
- **Context**: 실행 시점의 컨텍스트 오브젝트이며, 최소 `contextId`와 `adapterId`를 포함한다.

- **Pipeline**: 어댑터가 정적으로 선언하는 실행 단계열(순서 포함)이다. 프레임워크/컴파일러는 Pipeline 선언을 인지하여 정적 wiring을 생성한다.
- **PipelineStep**: Pipeline을 구성하는 단일 실행 단위이다.
- **Exception Filter**: throw로 발생한 예외를 입력으로 받아, 표준 Result로 변환하거나(처리) 다음 단계로 전달(통과)하는 실행 단계이다.
- **Exception Filter Chain**: 순서가 있는 Exception Filter의 리스트이다. 예외는 체인의 앞에서 뒤로 전달되며, 처리되지 않은 예외는 체인의 후단으로 전달된다.
- **Middleware**: 입력/컨텍스트를 전처리하거나 공통 cross-cut을 적용하는 실행 단계이다.
- **Guard**: 핸들러 접근을 제어하는 실행 단계이다. 목적은 보안/권한/접근 제어이며, 데이터 변환/검증과 무관하다.
- **Pipe**: 데이터 가공을 수행하는 실행 단계(또는 그 컨테이너)이다. Pipe는 변환(transform) 및 검증(validate)을 포함할 수 있으나, 접근 제어(Guard)를 포함하지 않는다.
- **Transform**: 입력 representation을 다른 representation으로 변환하는 데이터 가공 동작이다.
- **Validate**: 입력을 검사하여 통과 또는 거부를 결정하는 데이터 가공 동작이다.
- **Handler**: 어댑터가 최종적으로 호출하는 사용자 함수(요청 처리 엔트리)이다.

- **DTO**: 데이터 전송 객체. 비즈니스 로직을 포함하지 않는 구조적 데이터이다.

- **Raw Input**: 프레임워크가 변환/검증 완료를 가정하지 않는 입력 모드이다. Raw Input은 핸들러로 그대로 전달될 수 있다.

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
