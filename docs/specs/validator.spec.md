# Validator

Bunner의 Validator는 데이터의 유효성을 검증하는 시스템이다. 외부 라이브러리(class-validator 등)에 대한 런타임 의존성을 제거하고, AOT 컴파일을 통해 고성능 검증 로직을 구현한다.

## Key Philosophy & Features

- **Zero Dependency (제로 의존성):**
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
