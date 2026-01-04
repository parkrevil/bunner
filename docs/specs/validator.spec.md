## ✅ Validator

Bunner의 Validator는 데이터의 유효성을 검증하는 시스템이다. 외부 라이브러리(class-validator 등)에 대한 런타임 의존성을 제거하고, AOT 컴파일을 통해 고성능 검증 로직을 구현한다.

### Key Philosophy & Features

- **Zero Dependency (제로 디펜던시):**
  - 무거운 검증 라이브러리를 런타임에 포함하지 않는다.
  - 필요한 검증 로직은 빌드 타임에 생성되어 애플리케이션에 내장된다.

- **Declarative Rules (선언적 규칙):**
  - DTO 클래스 프로퍼티에 데코레이터를 붙여 검증 규칙을 정의한다.
  - 코드는 간결하게 유지하면서도 강력한 제약 조건을 표현할 수 있다.

- **Fail-Fast Strategy (빠른 실패 전략):**
  - 유효하지 않은 데이터는 비즈니스 로직에 진입하기 전에 차단된다.
  - 검증 실패 시 즉시 표준 에러(`BadRequest` 등)를 반환하여 불필요한 연산을 방지한다.

- **Separation of Validation Logic:**
  - 검증 로직은 비즈니스 로직과 분리되어 별도의 레이어에서 수행된다.
  - 핸들러는 항상 "유효함이 보장된" 데이터만 수신한다.

### ⚙️ CLI - @bunner/cli

- **Validation Code Generation:**
  - DTO의 검증 데코레이터를 분석하여, 최적화된 검증 함수(Validator Function)를 생성한다.
  - 생성된 함수는 순차적으로 조건을 검사하며, 실패 시 상세한 에러 정보를 반환하도록 구성된다.

### 📐 Common - @bunner/common

검증 규칙 선언을 위한 표준 데코레이터를 제공한다.

- **Common Validators:**
  - `@IsString()`, `@IsNumber()`, `@IsBoolean()`: 기본 타입 검사.
  - `@IsOptional()`: 선택적 필드 처리.
  - `@Min()`, `@Max()`, `@Length()`: 범위 및 길이 검사.
  - `@Matches(regex)`: 정규식 패턴 검사.
  - `@ValidateNested()`: 중첩된 객체 검증.

- **Custom Validator:**
  - 사용자가 직접 검증 로직을 작성하여 데코레이터로 사용할 수 있는 확장 인터페이스를 제공한다.

### 🔌 Adapters

- **Validation Pipeline:**
  - 어댑터는 Transformer를 거친 데이터를 Validator에 전달하여 유효성을 검사한다.
  - 검증에 실패하면, 어댑터는 이를 적절한 에러 응답(예: 400 Bad Request)으로 변환하여 클라이언트에게 반환한다.
