## 🚦 Error Handling Methodology

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

- **AOT Compiled Pipeline (AOT 컴파일된 파이프라인):**
  - 미들웨어, 가드, 핸들러의 실행 순서를 런타임에 동적으로 계산하지 않는다.
  - 단지 `AsyncLocalStorage`와 같은 **저수준 프리미티브(Low-level Primitive)**를 안전하게 감싼 런타임 헬퍼만 제공한다.
  - 어댑터가 정의한 파이프라인 흐름을 분석하여, 단일 함수 호출 체인(Function Composition)으로 최적화된 실행 코드를 생성한다.

- **Default Framework Error Filter (프레임워크 기본 에러 필터):**
  - 파이프라인의 가장 바깥쪽에 위치하는 **최후의 보루(Last Resort)**이다.
  - 사용자 정의 필터 체인에서 처리되지 않고 흘러나온(Pass-through) 예외나, 필터 실행 중 발생한 예외를 모두 포착하여 표준 시스템 에러 결과(Result)로 변환한다.
