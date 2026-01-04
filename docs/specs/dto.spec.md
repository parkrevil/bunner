## 📦 DTO (Data Transfer Object)

DTO는 계층 간 데이터 교환을 위한 순수한 데이터 컨테이너다. Bunner에서 DTO는 단순한 데이터 전달을 넘어, 입력 데이터의 구조를 정의하고 검증 규칙을 명세하는 **진실의 원천(Source of Truth)** 역할을 한다.

### Key Philosophy & Features

- **Class-Based Schema (클래스 기반 스키마):**
  - 인터페이스나 타입 별칭이 아닌, 클래스를 사용하여 DTO를 정의한다.
  - 클래스는 런타임에 값이 존재하므로, 컴파일된 자바스크립트 코드에서도 데이터 구조에 대한 메타데이터로 활용될 수 있다.
  - 이는 파싱, 검증, 문서화(Swagger/OpenAPI) 등 다양한 목적으로 재사용된다.

- **Single Source of Truth (단일 진실 공급원):**
  - DTO 클래스 하나에 데이터 구조, 타입, 필수 여부, 유효성 검사 규칙, API 문서화 정보가 모두 포함된다.
  - 중복 정의를 방지하고, 코드 변경 시 관련된 모든 메타데이터가 동기화되도록 보장한다.

- **Separation of Concerns (관심사 분리):**
  - DTO는 로직을 포함하지 않는 순수한 데이터 객체여야 한다.
  - 비즈니스 로직이 포함된 도메인 엔티티와 명확히 구분되어야 하며, 계층 간 결합도를 낮추는 역할을 수행한다.

- **Immutable by Default (기본 불변성):**
  - DTO는 생성 후 변경되지 않는 것을 권장한다.
  - 데이터의 흐름을 예측 가능하게 만들고, 부수 효과를 방지한다.

### ⚙️ CLI - @bunner/cli

DTO 정의를 활용하여 최적화된 코드를 생성한다.

- **Validation Schema Generation:**
  - DTO에 정의된 데코레이터와 타입 정보를 바탕으로, 런타임에 사용할 수 있는 고성능 검증 스키마를 미리 생성한다.
  - 불필요한 리플렉션 비용을 제거하고 검증 속도를 극대화한다.

- **API Documentation Extraction:**
  - `@bunner/docs`와 연동하여 DTO 구조를 분석하고, OpenAPI(Swagger) 등의 API 명세서에 자동으로 반영한다.

### 📐 Common - @bunner/common

DTO 정의에 필요한 데코레이터와 유틸리티를 제공한다.

- **Validation Decorators:**
  - `@IsString()`, `@IsInt()`, `@Min()`, `@Max()` 등 데이터 검증 규칙을 선언하는 데코레이터를 제공한다. (Validator Spec 참조)

- **Transformation Decorators:**
  - `@Type(() => Number)` 등 데이터 변환 규칙을 선언하는 데코레이터를 제공한다. (Transformer Spec 참조)

- **Api Property Decorators:**
  - `@ApiProperty()` 등 API 문서화를 위한 메타데이터 데코레이터를 제공한다.

### 🔌 Adapters

- **Automatic Binding:**
  - HTTP 어댑터 등은 요청 본문(Body)을 해당 핸들러가 요구하는 DTO 타입으로 자동 매핑한다.
  - 이 과정에서 정의된 검증 규칙과 변환 로직이 순차적으로 적용된다.
