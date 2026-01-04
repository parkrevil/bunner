## 🛡️ Error Handling

Bunner는 예측 가능하고 일관된 에러 처리 전략을 제공한다. "모든 것은 필터다(All is Filter)"라는 철학 아래, 예외 발생부터 응답 생성까지의 흐름을 단일화된 파이프라인으로 제어한다.

### Key Philosophy & Features

- **Unified Filter Chain (단일화된 필터 체인):**
  - 예외 처리를 위한 별도의 'Safety Net'이나 복잡한 핸들러 구조를 두지 않는다.
  - 오직 **Error Filter**들의 체인만이 존재하며, 예외는 이 체인을 따라 흐르며 처리된다.

- **No Recovery, Only Fall-through (복구 없는 통과):**
  - 필터는 예외를 잡아 정상적인 응답(`Result`)으로 변환하거나, 처리할 수 없다면 다음 필터로 넘긴다(re-throw).
  - 복잡한 복구 로직이나 흐름 제어를 지양하고, 단순한 **책임 연쇄 패턴(Chain of Responsibility)**을 따른다.

- **Default Framework Error Filter (기본 프레임워크 필터):**
  - 필터 체인의 가장 마지막에는 항상 프레임워크가 제공하는 기본 필터가 위치한다.
  - 사용자 정의 필터들이 처리하지 못한 모든 예외(패닉, 시스템 에러 등)를 최종적으로 포착하여, 클라이언트에게 일관된 시스템 에러 응답을 반환한다. "터지지 않는 서버"를 위한 최후의 보루다.

- **Result vs Exception (결과 대 예외):**
  - **Domain Error:** 비즈니스 로직 상의 실패(예: 잔액 부족, 중복 가입)는 예외(`throw`)가 아닌 `Result` 객체(`Failure`)로 반환하는 것을 권장한다. 이는 흐름 제어의 일부다.
  - **System Panic:** 시스템 장애, 버그, 예측 불가능한 상황(예: DB 연결 끊김, 널 포인터 참조)은 예외(`throw`)로 처리되며, 이는 Error Filter Chain에 의해 포착된다.

- **Standard Error Protocol (표준 에러 프로토콜):**
  - 모든 에러 응답은 `code`(기계적 식별자)와 `meta`(상세 정보)를 포함하는 표준 형식을 따른다.
  - HTTP 상태 코드 등 프로토콜 종속적인 정보는 도메인 에러 정의에 포함되지 않으며, 어댑터 계층에서 매핑된다.

### ⚙️ CLI - @bunner/cli

- **Auto-Generated Try-Catch:**
  - 핸들러와 미들웨어 등 실행 지점 주변에 최적화된 `try-catch` 블록을 자동으로 생성한다.
  - 예외 발생 시 즉시 필터 체인의 시작점으로 점프하도록 제어 흐름을 연결한다.

### 📐 Common - @bunner/common

- **Filter Interface:**
  - `catch(exception: unknown): Result | void` 형태의 단순한 인터페이스를 정의한다.
  - `Result` 반환 시 처리 완료, `void` 반환 시(또는 throw) 다음 필터로 위임을 의미한다.

- **Standard Error Types:**
  - `SystemError`, `DomainError` 등 에러의 성격을 구분하는 기본 타입과 인터페이스를 제공한다.

### 💎 Core - @bunner/core

- **Default Filter Implementation:**
  - 제거 불가능한 내장 필터(Default Framework Error Filter)를 구현하여 제공한다.
  - `Unknown Error`, `Out of Memory` 등의 치명적인 상황에서도 최소한의 JSON 응답을 보장한다.
