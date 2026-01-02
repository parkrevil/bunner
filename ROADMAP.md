# ROADMAP

Bunner 프레임워크의 개발 방향과 목표, 필요한 패키지를 정하고 초안을 기술한다.

---

## 🎯 목표

Bunner는 VISION.md를 핵심 가치관으로 둔다.

- Bun 환경에서만 동작하는 프레임워크를 구축한다.
- 장황한 설명 없이 구조와 코드가 프레임워크를 설명할 수 있어야 한다.
- 사용자의 러닝커브를 최소화 해야한다.
- 쉬운 방법 보단 단순한 방법을 제공한다.
- 명확하고 직관적이며 투명한 사용성을 제공한다.
- 백엔드 프레임워크의 뜨거운 감자를 고려하여 개발자들의 고충을 해결하기 위해 최선을 다한다.
- reflect-metadata를 사용하지 않는다.
- Multi-App, Multi-Adapter 지원

---

## 📝 메모

- bunfig.toml 사용 및 최적화 검토
- bun:bundle의 feature 사용 검토
  - 사용자가 사용한 feature만 골라내서 CLI에서 알아서 Build 스크립트를 최적화 할 수 있을까?

---

## 🧰 Common 기능 및 DX

- Angular 및 NestJS의 아키텍처 및 DX
- 고속
- 가벼움
- AST, AOT
- DI
- Pre-built Pipeline
- Adapter
- Middleware
- Guard
- Error Filter
- Result<T, E>
- Transformer
- Validator
- MCP
- Cluster Manager
- Like Nestjs Devtools
- Rust FFI Adapter Core

---

## 🧩 Module System

Bunner는 `imports` 배열이나 복잡한 모듈 등록 절차를 완전히 제거한다. **파일 시스템이 곧 모듈 트리**가 되는 구조를 채택하여, AOT 컴파일러가 디렉토리를 스캔하고 의존성을 자동으로 연결한다.

### Key Philosophy & Features

- **Directory-Based Auto-Discovery (디렉토리 기반 자동 발견):**
  - 개발자가 모듈을 어디에 등록할 필요가 없다. 컴파일러가 소스 디렉토리를 재귀적으로 스캔하여, **모듈 정의 파일(Module Definition File)**이 존재하는 디렉토리를 모듈의 경계로 인식하고 시스템에 자동으로 등록한다.
  - 이 파일이 존재하지 않는 일반 디렉토리의 컴포넌트들은 자동으로 가장 가까운 상위 모듈의 구성요소로 흡수된다.

- **Path-Based Identification (경로 기반 식별):**
  - 모듈의 유일성(Identity)은 물리적인 **파일 경로**에 의해 결정된다.
  - 여러 모듈에서 동일한 경로의 모듈을 참조하더라도, 컴파일러는 이를 단일 인스턴스로 식별하여 중복 생성을 원천 차단한다.

- **Zero-Config Wiring (설정 없는 연결):**
  - 다른 모듈의 기능을 사용하기 위해 별도의 등록 절차를 거칠 필요가 없다.
  - 언어 차원에서 제공하는 **표준 임포트(Import) 구문** 자체를 의존성 선언으로 간주한다. 컴파일러는 이 구문을 정적으로 분석하여 모듈 간의 의존성 그래프를 자동으로 구축한다.

- **Strict Visibility Control (엄격한 가시성 제어):**
  - 모듈 내부에서만 사용되어야 할 컴포넌트와 외부로 공개할 컴포넌트를 메타데이터를 통해 명확히 구분한다.
  - **Internal:** 내부 전용으로 설정된 컴포넌트를 외부 모듈에서 임포트하려고 시도하면, 런타임이 아닌 빌드 단계에서 즉시 에러를 발생시켜 아키텍처의 무결성을 강제한다.

### ⚙️ Adapter Configuration & Scoping

모듈 정의 파일은 단순한 마커 역할을 넘어, 해당 모듈 스코프 내에서 동작할 어댑터와 파이프라인을 제어하는 **중앙 설정소** 역할을 수행한다.

- **Module-Scoped Configuration (모듈 단위 설정):**
  - 각 모듈은 자신의 영역 내에서 활성화될 어댑터(HTTP, WebSocket 등)에 대해 독립적인 상세 설정을 가질 수 있다.
  - 미들웨어, 가드, 에러 필터 등의 파이프라인 구성 요소를 **어댑터별로 분리하여 등록**한다. 이를 통해 하나의 모듈 안에서도 HTTP 요청과 웹소켓 메시지에 대해 서로 다른 보안 정책이나 처리 로직을 적용할 수 있다.

- **Root-to-Global Propagation (전역 설정 전파):**
  - 애플리케이션의 진입점이 되는 **루트 모듈**에 정의된 어댑터 설정과 파이프라인은 애플리케이션 전체에 적용되는 **절대적인 전역 설정**으로 동작한다.
  - 하위 모듈들은 기본적으로 루트 모듈의 설정을 상속받으며, 필요에 따라 자신의 스코프 내에서만 유효한 설정을 추가하거나 오버라이딩하여 구체화한다.

### ⚙️ CLI - @bunner/cli

- **Recursive Scanner (재귀적 스캐너):**
  - 빌드 시점에 프로젝트의 전체 파일 시스템을 순회하며 모듈 정의 파일의 위치를 파악하고, 이를 기반으로 논리적인 모듈 트리를 구성한다.
  - 다른 모듈에서 참조되지 않더라도 독립적으로 실행되어야 하는 모듈(예: 크론 작업, 이벤트 리스너)을 이 단계에서 찾아내어, 누락 없이 애플리케이션에 포함시킨다.

- **Visibility Validator (가시성 검증기):**
  - 소스 코드의 `import` 구문을 분석할 때, 대상 컴포넌트의 가시성 설정(Internal/Export)을 확인한다. 규칙을 위반한 접근이 감지되면 컴파일을 중단하고 명확한 에러 메시지를 출력한다.

### 📐 Common - @bunner/common

- **Module Definition Helper (모듈 정의 헬퍼):**
  - 단순한 모듈의 경우 파일을 비워두거나 생략할 수 있도록 허용하며, 설정이 필요한 경우에만 메타데이터를 정의할 수 있는 헬퍼 함수를 제공한다.
  - 어댑터 설정, 프로바이더 등록, 전역 설정 오버라이딩 등 모듈 구성에 필요한 타입 정의와 스키마를 제공한다.

---

## 🚦 Error Architecture & Pipeline

Bunner는 실패를 '예상 가능한 도메인 실패(Result)'와 '예상치 못한 시스템 장애(Panic)'로 명확히 이원화한다. **표준화된 에러 컨테이너**와 **AOT 기반의 자동 계측(Instrumentation)**을 통해, 런타임 오버헤드 없이 강력한 디버깅 환경과 프로토콜 중립적인 비즈니스 로직을 보장한다.

### Key Philosophy & Features

- **Dual-Track Error System (이원화 에러 시스템):**
- **Expected Failure (도메인 실패):** 비즈니스 로직의 실패는 스택 트레이스가 없는 순수 데이터 객체(POJO) 형태로 `Result` 채널을 통해 반환된다. 이는 핫 패스(Hot Path)에서의 성능 저하를 방지한다.
- **Unexpected Panic (시스템 장애):** 인프라 장애나 버그는 `Error` 객체를 통한 예외(Throw)로 처리되며, 최상위 안전망에서 포착되어 격리된다.

- **Standardized Error Protocol (표준화된 에러 프로토콜):**
  - 모든 도메인 에러는 `code`(기계적 식별자)와 `meta`(직렬화 가능한 상세 정보)를 포함하는 **표준 컨테이너 규약**을 준수한다.
  - 특정 프로토콜(HTTP 등)의 상태 코드를 도메인 로직에 포함하지 않으며, 이는 어댑터 계층에서 변환 테이블을 통해 결정된다.

- **Zero-Cost Observability (제로 코스트 관측성):**
  - 에러 발생 위치를 추적하기 위해 런타임에 스택 트레이스를 생성하지 않는다.
  - 대신 AOT 컴파일러가 빌드 시점에 실패 생성 지점을 감지하여, 파일 경로와 핸들러 정보 등의 **정적 컨텍스트(Static Context)**를 인자로 주입한다.

- **Strict Protocol Boundary (엄격한 프로토콜 경계):**
  - 서비스 계층은 오직 도메인 의미만을 담은 실패를 반환한다.
  - 어댑터는 이를 받아 자신의 프로토콜(HTTP Status, gRPC Code 등)에 맞는 응답으로 변환하는 **매퍼(Mapper)** 역할에 집중하여, 멀티 어댑터 환경에서의 정합성을 유지한다.

### ⚙️ CLI - @bunner/cli

- **Static Instrumentation (정적 계측):**
  - 소스 코드를 분석하여 `Result.err` 또는 표준 에러 팩토리 호출 패턴을 감지한다.
  - 해당 호출 구문에 소스 파일 위치, 라인 번호, 실행 컨텍스트 정보를 담은 숨겨진 인자를 주입하여, 런타임 비용 없이 디버깅 정보를 확보한다.

- **Architecture Linter (아키텍처 린터):**
  - 서비스 계층이 `Result` 래퍼 없이 원시 값을 반환하거나, 컨트롤러가 도메인 에러를 처리하지 않고 누락(Exhaustive Check 위반)하는 경우를 빌드 타임에 검출하여 아키텍처 규칙을 강제한다.

### 📐 Common - @bunner/common

- **Standard Container Definition (표준 컨테이너 정의):**
  - `StandardError` 인터페이스를 통해 기계적 식별자(`code`)와 직렬화 안전성이 보장된 메타데이터(`meta`)의 구조를 정의한다. 스택 트레이스 생성 비용이 없는 POJO 형태를 강제한다.

- **Result Protocol Bridge (Result 프로토콜 브릿지):**
  - 프레임워크 표준 `Result` 객체와 더불어, 외부 라이브러리(`fp-ts` 등)와의 상호 운용성을 위한 변환 유틸리티를 제공한다. 경계(Boundary) 지점에서 표준 포맷으로의 안전한 변환을 지원한다.

### 💎 Core - @bunner/core

- **Railroad Pipeline Engine (철도 선로 파이프라인 엔진):**
  - 미들웨어, 가드, 핸들러를 거치는 동안 `Result` 객체의 흐름(성공/실패)을 제어한다. 도메인 실패가 반환되면 즉시 후속 로직을 중단하고 어댑터의 변환 레이어로 전달하는 단방향 흐름을 보장한다.

- **Global Panic Safety Net (글로벌 패닉 안전망):**
  - 파이프라인 최상단에 위치하여, `Result` 흐름을 벗어난 시스템 예외(`throw`)를 전담하여 포획한다.
  - AOT가 주입한 정적 컨텍스트와 런타임의 동적 컨텍스트(Request ID)를 결합하여 로깅하고, 클라이언트에게는 내부 정보를 감춘 일반적인 시스템 오류 응답을 반환한다.

## 💉 DI (Dependency Injection)

Bunner의 DI 시스템은 런타임 컨테이너의 오버헤드를 제거하고, 컴파일 타임에 확정된 정적 연결(Static Wiring)을 통해 극한의 성능을 제공한다. 특히, 프레임워크 코어와 어댑터의 구분 없이 모든 데코레이터 처리 로직을 **단일 매니페스트 파이프라인**으로 통합하여 일관된 아키텍처를 유지한다.

### Key Philosophy & Features

- **Unified Manifest Architecture (단일 매니페스트 아키텍처):**
  - 프레임워크가 기본으로 제공하는 데코레이터와 어댑터가 제공하는 확장 데코레이터를 구분하지 않는다.
  - 컴파일러는 데코레이터의 의미를 하드코딩하지 않으며, `Common` 패키지와 `Adapter` 패키지가 제공하는 **정적 명세(Manifest)**를 읽어 동일한 로직으로 처리한다. 이를 통해 컴파일러의 복잡도를 낮추고 확장성을 극대화한다.

- **Compile-Time Static Wiring (컴파일 타임 정적 연결):**
  - 애플리케이션 구동 시점에 의존성을 탐색하는 과정(Reflection)을 없앤다.
  - 빌드 시점에 의존성 그래프를 분석하여, 인스턴스를 생성하고 할당하는 최적화된 코드를 미리 작성한다. 런타임에는 단순한 변수 할당과 함수 호출만이 남는다.

- **Function-Based Marker (함수 기반 마커 주입):**
  - 생성자에 의존성을 나열하는 방식 대신, 멤버 필드에서 **의존성 주입 지시 함수**를 호출하는 방식을 사용한다.
  - 이 함수는 런타임 로직을 수행하는 것이 아니라, AOT 컴파일러에게 "이 곳에 특정 구성요소를 주입하라"는 신호를 보내는 마커(Marker) 역할을 수행한다.

- **Scope-Aware Proxy Injection (스코프 인지형 프록시 주입):**
  - 수명 주기가 긴 싱글톤 객체(예: 컨트롤러)가 수명 주기가 짧은 리퀘스트 스코프 객체를 주입받을 때 발생하는 불일치 문제를 자동으로 해결한다.
  - 컴파일러는 이러한 관계를 감지하면, 런타임에 현재 요청 컨텍스트를 동적으로 찾아가는 **고성능 투명 프록시(Transparent Proxy)** 코드를 생성하여 주입한다. 개발자는 스코프 차이를 신경 쓰지 않고 비즈니스 로직을 구현할 수 있다.

### ⚙️ CLI - @bunner/cli

- **Manifest Loader & Processor:**
  - 빌드 초기 단계에 `Common` 패키지와 설치된 `Adapter`들의 매니페스트 파일을 로드하여, 사용 가능한 데코레이터와 주입 규칙을 통합된 딕셔너리로 구축한다.

- **Wiring Code Generator:**
  - 분석된 의존성 그래프를 바탕으로 순수 자바스크립트 팩토리 코드를 생성한다. 의존성 주입 지시 함수가 있던 자리를 실제 인스턴스 참조나 프록시 생성 코드로 1:1 치환한다.

### 📐 Common - @bunner/common

- **Core Manifest Definition:**
  - 프레임워크의 표준 동작을 정의하는 매니페스트를 제공한다. 주입 가능한 구성요소임을 알리는 데코레이터, 스코프 정의, 가시성 설정 등의 규칙이 기술되어 있다.

- **Component Definition Decorator:**
  - 클래스가 DI 시스템에 의해 관리되는 **구성요소(Component)**임을 선언한다. 이 데코레이터를 통해 해당 클래스의 스코프(싱글톤, 요청 단위 등)와 모듈 간 가시성(내부 전용, 외부 공개)을 설정할 수 있다.

- **Dependency Marker Function:**
  - 멤버 변수 초기화 위치에서 사용되어, 구체적인 주입 대상을 컴파일러에게 알리는 역할을 한다. 클래스 참조나 별도의 토큰을 인자로 받아 의존성을 명시한다.

### 💎 Core - @bunner/core

- **Runtime Context Bridge:**
  - `AsyncLocalStorage`를 활용하여 요청별 컨텍스트를 격리하고 관리한다. CLI가 생성한 프록시 객체가 이 브리지를 통해 현재 요청에 해당하는 올바른 인스턴스에 접근할 수 있도록 저수준 API를 제공한다.

---

## 📦 DTO (Data Transfer Object)

DTO라는 개념 자체는 사용되겠지만 용어가 모호함. 사용자에게 프레임워크 권장 용어를 어필할 필요가 있음

- **HTTP**: Body, Query, Params, Headers, Response
  - CreateUserBody, CreateUserResponse, ListQuery, UserIdParams
- **gPRC**: Request, Response
  - CreateUserRequest, CreateUserResponse
- **WS**: Payload, Response, Message
  - CreateUserPayload, CreateUserResponse, StartMaintenanceMessage
- **Queue**: Message, Event
  - CreateUserMessage, CreateUserEvent
- **TCP, UDP, QUIC**: Packet
  - CreateUserPacket

---

## 🔄 Transformer

Bunner의 Transformer는 직관적인 선언형 개발 방식을 유지하면서, 런타임 성능 비용을 제로(Zero)로 만드는 것을 목표로 한다. AOT 컴파일러가 개발자의 의도를 분석하여 최적화된 코드를 대신 작성해 주는 형태로 동작한다.

### Key Philosophy & Features

- **Zero Runtime Overhead (제로 런타임 오버헤드):**
  - 프로그램 실행 중에 객체의 구조를 분석하거나 변환 규칙을 탐색하는 과정을 없앤다. 사람이 수동으로 최적화하여 작성한 코드와 동일한 성능을 내는 정적 코드를 생성한다.

- **Smart Inference (지능형 추론):**
  - 개발자가 일일이 변환 규칙을 명시하지 않아도, 컴파일러가 코드의 문맥을 이해하여 자동으로 처리한다. 기본 데이터 타입이나 명시적인 클래스 타입이 감지되면, 가장 최적화된 변환 로직을 스스로 적용하여 개발 생산성을 높인다.

- **Security by Default (보안 중심 설계):**
  - **Implicit Stripping:** 외부에서 유입되는 데이터 중, 애플리케이션에 정의되지 않은 불필요한 속성은 변환 과정에서 자동으로 제거하여 데이터 오염 및 보안 취약점을 원천 차단한다.
  - **Safe Instantiation:** 데이터 객체를 생성할 때 발생할 수 있는 런타임 오류를 방지하기 위해, 안전한 초기화 규칙을 준수하도록 유도한다.

- **Separation of Concerns (역할의 명확한 분리):**
  - **Structural Definition (구조적 정의):** 단순한 값의 변경이 아니라, 데이터를 특정 클래스의 인스턴스나 날짜(Date)와 같은 표준 객체로 구체화하는 "생성(Creation)"의 역할을 담당한다. 순환 참조와 같은 복잡한 참조 관계에서도 안전하게 객체를 조립할 수 있는 메커니즘을 제공한다.
  - **Logic Application (로직 적용):** 데이터의 형태를 가공하거나 사용자 정의 비즈니스 로직을 주입하는 "변형(Manipulation)"의 역할을 담당한다. 입력 데이터를 객체로 만들 때와 객체를 다시 내보낼 때의 로직을 명확히 분리하여 관리할 수 있는 체계를 지원한다.

- **Context-Aware Serialization (상황별 노출 제어):**
  - 하나의 데이터 모델을 관리자용, 일반 사용자용 등 다양한 상황에 맞춰 다르게 표현할 수 있는 기능을 제공한다. 런타임에 조건을 검사하는 대신, 상황별로 전용 변환 코드를 미리 생성하여 성능 저하 없이 유연한 데이터 표현을 가능하게 한다.

### ⚙️ CLI - @bunner/cli

애플리케이션 빌드 단계에서 데이터 모델을 분석하여 실제 실행 가능한 코드를 생성하는 엔진이다. 런타임 라이브러리에 대한 의존성 없이 독립적으로 동작하는 순수 자바스크립트 코드를 만들어낸다.

- **Serializer Generator (직렬화 코드 생성):**
  - 데이터의 구조 중 변하지 않는 부분(키 이름, JSON 구문 등)은 상수로 미리 고정하고, 변하는 데이터만 빠르게 바인딩하는 최적화된 템플릿 코드를 생성한다.
  - 문자열 처리나 특수문자 변환과 같이 빈번하게 호출되는 유틸리티 로직은 외부 함수 호출을 피하고, 검증된 고성능 코드를 생성된 파일 내부에 직접 포함시켜 실행 속도를 극대화한다.

- **Deserializer Generator (역직렬화 코드 생성):**
  - 외부 데이터를 내부 객체로 변환할 때, 반복문이나 동적 탐색을 사용하지 않는다. 원본 데이터의 필드를 타겟 객체의 속성에 1:1로 직접 할당하는 단순하고 강력한 코드를 생성하여 엔진 처리 효율을 높인다.
  - 구조적 정의나 커스텀 로직이 필요한 필드에 대해서는 해당 변환 로직을 코드가 할당되는 시점에 인라인 형태로 주입한다.

### 📐 Common - @bunner/common

프레임워크 사용자와 컴파일러 간의 약속을 정의하는 인터페이스 계층이다. 실제 동작 로직은 포함하지 않으며, 개발자가 변환 규칙을 선언적으로 명세할 수 있는 도구들을 제공한다.

- **Visibility Control (노출 범위 제어):**
  - 데이터 변환 과정에서 포함할 필드와 제외할 필드를 명확히 지정하고, 특정 상황(Context)에서만 노출되어야 하는 필드 그룹을 정의하는 기능을 제공한다.

- **Structural Transformation Definition (구조 변환 정의):**
  - 중첩된 객체나 배열, 혹은 특수한 인스턴스화 과정이 필요한 필드에 대해 그 구조적 관계를 명시하는 도구를 제공한다. 컴파일러는 이를 통해 객체 생성 그래프를 파악하고 최적화된 파서(Parser)를 연결한다.

- **Custom Logic & Manipulation (커스텀 로직 정의):**
  - 단순한 타입 변환을 넘어선 값의 가공이나 계산 로직을 적용할 수 있는 수단을 제공한다.

- **Bidirectional Conversion Interface (양방향 변환 인터페이스):**
  - 복잡한 변환 로직을 작성할 때, 데이터를 받아들일 때(Input)와 내보낼 때(Output)의 처리를 명확히 구분하여 구현할 수 있는 표준 규격을 제공한다. 이를 통해 변환 로직의 재사용성을 높이고 유지보수를 용이하게 한다.

---

## ✅ Validator

`class-validator`의 익숙한 선언형 검증 방식을 유지하되, 런타임에 외부 검증 라이브러리에 의존하지 않고 순수 자바스크립트 로직으로 컴파일되는 제로 디펜던시(Zero Dependency) 검증 시스템을 구축한다.

### Key Philosophy & Features

- **Zero Runtime Dependency (제로 런타임 의존성):**
  - 실행 시점에 `class-validator`나 `zod`, `joi`와 같은 무거운 외부 라이브러리를 전혀 사용하지 않는다. 오직 컴파일러가 생성한 순수 조건문만으로 동작하여 가장 가벼운 실행 환경을 보장한다.

- **Result-Oriented Architecture (결과 지향적 설계):**
  - 검증 실패 시 예외(Exception)를 던져 흐름을 끊는 대신, 실패의 원인과 세부 내용을 담은 결과 객체(Result)를 반환한다. 이를 통해 검증 로직을 제어 흐름의 일부로 자연스럽게 통합하고, `try-catch` 블록 없는 깔끔한 코드를 유도한다.

- **Native Operator Optimization (네이티브 연산 최적화):**
  - 런타임에 메타데이터를 순회하며 검증 규칙을 찾는 과정을 제거한다. 빌드 타임에 검증 규칙을 분석하여 `typeof`, `length`, 정규식 검사 등 자바스크립트 엔진이 가장 빠르게 처리할 수 있는 네이티브 연산자 코드로 변환한다.

- **Schema-less & POJO (스키마리스 구조):**
  - 검증을 위해 별도의 스키마 객체를 메모리에 생성하거나 유지하지 않는다. 검증 실패 시 생성되는 에러 객체 또한 메서드가 없는 순수한 데이터 객체(POJO)로 구성하여 직렬화와 전송 효율을 높인다.

### ⚙️ CLI - @bunner/cli

- **Branch Prediction Optimization (분기 예측 최적화):**
  - 검증 로직을 생성할 때, 가장 빈번하게 실패할 가능성이 높은 조건을 상단에 배치하거나 중첩된 검증을 평탄화(Flatten)하여 CPU의 분기 예측 효율을 높일 수 있는 코드를 생성한다.
- **Fail-Fast Code Generation:**
  - 전체 검증을 수행하는 모드와 첫 번째 실패 시 즉시 중단하는 모드를 지원하며, 이에 맞춰 불필요한 연산을 수행하지 않는 최적화된 코드를 각각 생성한다.

### 📐 Common - @bunner/common & 💎 Core - @bunner/core

- **Marker Decorators (마커 데코레이터):**
  - 실제 검증 로직은 포함하지 않고, 컴파일러에게 검증 규칙(문자열 여부, 길이 제한, 이메일 형식 등)을 전달하는 메타데이터 역할만 수행한다.
- **Pluggable Failure Formatter (플러그인 가능한 포맷터):**
  - 프레임워크는 검증 실패에 대한 원시 데이터(필드명, 원인, 입력값)만 제공하며, 최종 응답 형태(에러 메시지 포맷, 다국어 처리 등)는 어댑터나 사용자가 주입한 포맷터에 의해 유연하게 결정될 수 있는 구조를 제공한다.

---

## 🔌 Adapter

Bunner 프레임워크를 HTTP, WebSocket, gRPC 등 다양한 네트워크 프로토콜 및 실행 환경과 연결하는 물리적 계층이다. 프레임워크의 코어 로직과 프로토콜 구현체를 완벽하게 분리하여 확장성과 유연성을 극대화한다.

### Key Philosophy & Features

- **Protocol Translation (프로토콜 번역):**
  - 각 프로토콜 고유의 요청과 응답 객체를 프레임워크가 이해할 수 있는 표준 컨텍스트(Context)와 결과(Result)로 변환하는 역할을 담당한다. 프레임워크 내부 로직은 현재 어떤 프로토콜 위에서 동작하는지 알 필요가 없도록 격리된다.

- **Multi-Adapter Support (다중 어댑터 지원):**
  - 하나의 애플리케이션 인스턴스 위에서 여러 개의 어댑터를 동시에 구동할 수 있는 아키텍처를 지원한다. 예를 들어, 동일한 비즈니스 로직을 HTTP API와 WebSocket 이벤트 핸들러가 동시에 공유하여 처리할 수 있다.

- **Lifecycle Management (생명주기 관리):**
  - 서버의 시작과 종료, 연결 수립 및 해제와 같은 프로토콜 레벨의 생명주기를 관리하며, 이를 프레임워크 전체의 라이프사이클과 동기화하여 안정적인 운영을 보장한다.

### ⚙️ CLI - @bunner/cli

어댑터의 정적 명세(Manifest)를 기반으로 사용자의 컨트롤러와 실제 프로토콜 구현체를 물리적으로 연결(Wiring)하는 코드를 생성한다.

- **Manifest-Based Wiring (매니페스트 기반 연결):**
  - 어댑터 패키지가 제공하는 정적 매니페스트 파일을 읽어, 해당 어댑터가 지원하는 고유의 데코레이터(URL 경로, 메시지 패턴 등)를 해석한다. 이를 바탕으로 런타임 라우터 등록 코드를 자동으로 생성하여, 어댑터 개발자가 별도의 컴파일러 플러그인을 작성하지 않아도 AOT 최적화를 누릴 수 있게 한다.

- **Runtime Bootstrapping Generator (구동 코드 생성):**
  - 사용자가 설정한 어댑터들을 초기화하고, 프레임워크의 라이프사이클에 등록하는 부트스트랩 코드를 생성한다. 여러 어댑터가 등록된 경우, 각 어댑터의 구동 순서와 의존성을 고려하여 병렬 또는 직렬로 실행되는 최적화된 시동 시퀀스를 작성한다.

### 📐 Common - @bunner/common

어댑터 구현체가 반드시 준수해야 하는 **표준 인터페이스와 통신 규약(Protocol Contract)**을 정의한다.

- **Adapter Interface & Manifest Schema:**
  - 모든 어댑터가 구현해야 하는 표준 메서드(서버 시작/종료, 요청 처리 위임 등)와, CLI가 어댑터의 기능을 이해하기 위해 필요한 매니페스트 파일의 JSON 스키마를 정의한다.

- **Abstract Context & Result Definition:**
  - 프로토콜에 종속되지 않는 추상화된 요청 컨텍스트와 응답 결과 객체의 타입을 정의한다. 이를 통해 어댑터 개발자는 자신의 프로토콜 데이터를 이 표준 규격에 맞춰 변환하는 것만으로 프레임워크와 연동할 수 있다.

### 💎 Core - @bunner/core

어댑터가 요청을 받아 비즈니스 로직으로 전달할 때 거쳐야 하는 **표준 실행 파이프라인(Execution Pipeline)**을 제공한다.

- **Pipeline Executor (파이프라인 실행기):**
  - 어댑터가 원본 요청을 받아 프레임워크로 넘기는 순간, 설정된 미들웨어, 가드, 인터셉터, 파이프를 순서대로 실행하고 최종적으로 컨트롤러 핸들러를 호출하는 **중앙 처리 엔진**을 제공한다. 어댑터는 복잡한 호출 체인을 직접 구현할 필요 없이, 이 실행기에 컨텍스트만 주입하면 된다.

- **Error Boundary Integration (에러 경계 통합):**
  - 파이프라인 실행 중 발생하는 모든 예외를 포착하여 표준 에러 형식으로 변환하는 메커니즘을 제공한다. 어댑터는 이 표준 에러를 받아 자신의 프로토콜에 맞는 에러 응답(예: 400 Bad Request, Error Frame)으로 최종 변환하여 클라이언트에게 전달한다.

---

## ⚙️ CLI - @bunner/cli

- Compiler, AST, AOT
  - Manifest 생성
    - 개발용 Manifest
      - 최대 정보량
    - 배포용 Manifest
      - 최소 정보량
- 빌드 타임에 최대한 친절한 에러 메시지 제공
  - What, Where, Why, How

### 명령어

- **bunner dev**
  - 개발 서버 실행
  - MCP를 위해 Manifest를 최대 정보량으로 생성
- **bunner build**
  - 빌드
  - 운영용 결과물을 생성하기에 Manifest를 최소 정보량으로 생성
- **bunner firebet**
  - 불빠따로 에이전트 혼내는용
  - 코드 스타일 검사
  - Typescript 문법 최적화 검사
  - bunner-firebet.config.json
    - 검사 규칙 정의(eslintconfig와 비슷하게)
  - --fix: 가능하면 자동 수정
  - --audit: 보안 취약점이나 성능 저하 코드 검출
- **bunner new**
  - 프로젝트 생성
- **bunner init**
  - 현재 디렉토리에 프로젝트 생성(기능은 bunner new와 동일)
- **bunner upgrade**
  - 코어 및 디펜던시 업그레이드
- **bunner info**
  - OS, Bun 버전, Bunner 버전, 사용 중인 어댑터 목록 출력
- **bunner version**
  - 버전 확인
- **bunner graph**
  - DI 의존성 그래프 출력
  - --json: json 파일로 생성
  - --svg: svg 파일로 생성
- **bunner generate, g**
  - controller, c
  - service, s
  - middleware, mw
  - guard, g
  - pipe, p
  - filter, f
  - error-filter, e
  - module, m

---

## 📐 Common - @bunner/common

_TBD_

---

## 💎 Core - @bunner/core

- **Error Filter**
  - Nestjs Exception Filter와 거의 유사
  - Result<T, E> 방식에서 에러필터가 필요할까? 단순 SystemErrorHandler로 처리하는 것은 어떨까?

```typescript
@ErrorFilter(MongoError, SomeError)
export class ErrorFilter implements ErrorFilterInterface {
  catch(error: Error, ctx: Context): Result<bool, string | number | boolean | Error> {
    if (error instanceof MongoError) {
      return error(new Error('mongo error'));
    }

    return error(error);
  }
}
```

- **Middleware**

```typescript
export function cors(options?: CorsOptions): {
  return async (ctx: Context): Result<bool, string | number | boolean | Error> {
    if (a != 1) {
      return error(new Error('cors error'));
    }

    if (b != 2) {
      return error('error');
    }

    return ok(true);
  }
}
```

- **Guard**
  - Nestjs Guard와 비슷
- **Pipe**
  - Nestjs Pipe와 비슷

---

## 📜 Logger - @bunner/logger

- Bun.stringWidth 사용 검토

---

## 🛡️ Error Filter (Exception-to-Standard Bridge)

Bunner의 Error Filter는 예외를 포획하여 프레임워크가 이해할 수 있는 **표준 컨테이너 형식**으로 변환하는 중간 처리 장치다. 단, 모든 예외를 도메인 실패로 억지 변환하지 않으며, 처리할 수 없는 치명적 오류는 상위로 흘려보내는 **선별적 처리(Selective Handling)**를 원칙으로 한다.

### Key Philosophy & Features

- **Format Standardization & Semantic Neutrality (형식 표준화 및 의미 중립성):**
  - 서드파티 라이브러리의 예외를 포획하여 **표준 에러 컨테이너** 규격으로 맞춘다.
  - 이때 **Error Filter는 예외의 ‘의미’를 재해석하거나 재분류하지 않으며, 오직 사전에 정의된 매핑 규칙에 따라 형식만 변환한다.** 필터가 비즈니스 로직에 개입하는 것을 원천 차단하여 순수성을 유지한다.

- **Channel Separation (채널 분리 확정):**
  - **표준 실패로 변환된 결과는 ‘예상된 실패(Expected Failure)’로 간주되어 Result 채널로 복귀하며, 변환되지 않은 시스템 장애는 반드시 예외 전파(Re-throw) 경로를 통해 글로벌 안전망으로 전달된다.**
  - 이를 통해 '도메인 실패'와 '시스템 패닉'의 처리 경로가 필터 단계에서 최종적으로 확정된다.

- **Exclusive Response Responsibility (응답 책임의 독점):**
  - 필터는 절대 응답을 직접 생성하거나 클라이언트로 전송하지 않는다.
  - 변환된 결과 객체를 파이프라인으로 돌려보낼 뿐이며, 최종적인 **프로토콜 응답 작성(Response Emission)은 오직 어댑터의 응답 처리 단계에서만 독점적으로 수행된다.**

- **Pass-Through Mechanism (패스 스루 메커니즘):**
  - 필터는 모든 예외를 삼키는 블랙홀이 아니다.
  - 처리할 수 없거나 보안상 즉시 중단해야 하는 치명적 오류(Bug, Invariant Violation)라고 판단되면, 변환을 시도하지 않고 그대로 재전파(Re-throw)하여 글로벌 패닉 안전망이 처리하도록 한다.

### ⚙️ CLI - @bunner/cli

- **Boundary-Only Wiring (경계 한정 와이어링):**
  - AOT 컴파일러가 생성하는 보호 블록(Try-Catch)은 등록된 스코프 내부의 **핸들러 경계(Handler Boundary)**에만 엄격하게 적용된다.
  - 함수 내부의 데이터 흐름이나 변수를 임의로 추적하지 않으며, 변환이 적용된 위치와 사유를 **빌드 리포트**를 통해 투명하게 설명한다.

### 📐 Common - @bunner/common

- **Strict Return Contract (엄격한 반환 계약):**
  - 필터 구현체는 '표준 실패 객체 반환(Result)' 또는 '예외 재전파(Throw)' 중 하나의 행동만을 수행해야 함을 규약으로 강제한다.

### 💎 Core - @bunner/core

- **Recovery & Escalation (복구 및 확산):**
  - 필터가 표준 실패를 반환하면 이를 정상 흐름의 실패 채널로 복귀시켜 어댑터로 전달한다.
  - 필터가 예외를 재전파하거나 필터 내부에서 오류가 발생하면, 이를 즉시 상위 계층으로 확산시켜 최상위 안전망이 로그를 남기고 시스템 에러 응답을 생성하게 한다.

---

## 📖 Docs - @bunner/docs

_TBD_

---

## 🔌 HTTP Adapter - @bunner/http-adapter

_TBD_

---

## 🔌 Websocket Adapter - @bunner/websocket-adapter

_TBD_

---

## 🔌 Socket IO Adapter - @bunner/socket.io-adapter

_TBD_

---

## 🔌 Redis Adapter - @bunner/redis-adapter

_TBD_

---

## 💧 Drizzle ORM - @bunner/drizzle-orm

_TBD_

---

## 🧪 Testing - @bunner/testing

_TBD_
