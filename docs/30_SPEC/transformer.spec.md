# Transformer

Bunner의 Transformer는 데이터의 형태를 변환(Transformation)하는 역할을 담당한다. 주로 요청 데이터를 DTO로 변환하거나, DTO를 응답 데이터로 직렬화하는 과정에서 사용된다.

## Key Philosophy & Features

- **Zero Overhead Declaration (제로 오버헤드 선언):**
  - 변환 규칙은 선언적(Decorator)으로 정의되지만, 런타임 성능 저하를 일으키지 않는다.
  - AOT 컴파일러가 선언된 규칙을 분석하여 최적화된 변환 코드를 생성한다.

- **Explicit Transformation (명시적 변환):**
  - 암묵적인 형변환을 지양한다.
  - 문자열을 숫자로, JSON을 객체로 변환하는 등의 작업은 명시적인 규칙에 따라 수행된다.

- **Layered Application (계층적 적용):**
  - 변환은 파이프라인의 특정 단계(주로 Validator 앞단)에서 수행된다.
  - 입력 데이터가 올바른 타입으로 변환된 후 검증 단계로 넘어가도록 보장한다.

- **Context-Aware Transformation (컨텍스트 인지 변환):**
  - 동일한 DTO라도 상황(그룹)에 따라 다른 변환 규칙을 적용할 수 있다.
  - 예: 민감한 정보는 응답 시 제외하거나, 특정 그룹에게만 노출한다.
