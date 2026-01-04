## 💉 Dependency Injection (DI)

Bunner의 DI 시스템은 런타임에 의존성을 탐색하고 해결하는 전통적인 방식과 다르다. **정적 연결(Static Wiring)** 방식을 채택하여, 컴파일 타임에 모든 의존성 그래프를 확정하고 실행 코드로 변환한다.

### Key Philosophy & Features

- **Static Resolution (정적 해결):**
  - "누가 누구를 필요로 하는가"는 코드를 작성하는 시점에 이미 결정되어 있다.
  - 런타임에 컨테이너가 의존성을 조회하거나 주입할 대상을 찾지 않는다.
  - CLI가 빌드 타임에 분석한 의존성 그래프를 바탕으로, 객체 생성과 주입 코드를 직접 생성(Hard-wiring)한다.

- **No Runtime Container (런타임 컨테이너 부재):**
  - 무거운 IoC 컨테이너가 런타임에 존재하지 않는다.
  - 생성된 코드는 순수한 자바스크립트 객체 생성 및 전달 로직(예: `new Controller(new Service())`)으로 변환된다.
  - 이는 컨테이너 조회 비용을 제거하고, 완벽한 Type-Safe를 보장한다.

- **Explicit Scope Management (명시적 스코프 관리):**
  - **Singleton (기본값):** 애플리케이션 시작 시 한 번 생성되어 재사용된다. 대부분의 컴포넌트는 이 스코프를 따른다.
  - **Request Scope (제한적 허용):** 요청 단위 격리가 반드시 필요한 경우에만 허용된다. 하지만 런타임 동적 생성이 아닌, 설계 단계에서 정해진 팩토리 패턴으로 처리되어 성능 저하를 최소화한다.

- **Compile-Time Validation (컴파일 타임 검증):**
  - 순환 의존성(Circular Dependency), 미해결 의존성, 스코프 불일치 등의 문제를 빌드 타임에 검출한다.
  - 의존성 그래프의 완전성을 보장하여, 런타임에 "주입 실패"로 인한 에러가 발생할 가능성을 제거한다.

### ⚙️ CLI - @bunner/cli

DI 시스템의 핵심 엔진으로, 정적 분석과 코드 생성을 담당한다.

- **Dependency Graph Construction:**
  - 소스 코드를 분석하여 컴포넌트 간의 의존성 관계를 파악하고, 전체 애플리케이션의 의존성 그래프를 구축한다.
  - 생성자 파라미터 타입을 분석하여 주입할 대상을 식별한다.

- **Wiring Code Generation:**
  - 확정된 의존성 그래프를 순회하며, 올바른 순서대로 인스턴스를 생성하고 주입하는 코드를 생성한다.
  - 위상 정렬(Topological Sort)을 통해 생성 순서를 결정한다.

- **Circular Dependency Detection:**
  - 그래프 분석 과정에서 순환 참조가 발견되면 즉시 빌드를 중단하고, 순환 경로를 명확히 보여주는 에러 메시지를 출력한다.

### 📐 Common - @bunner/common

DI 시스템을 위한 선언적 마커를 제공한다.

- **Dependency Markers:**
  - `@Injectable()`, `@Controller()` 등 컴포넌트의 역할을 정의하는 데코레이터를 제공한다.
  - `@Inject()`와 같이 특정 토큰이나 타입을 명시적으로 주입해야 할 때 사용하는 마커를 정의한다.
  - 이들은 런타임 로직 없이 오직 컴파일러에게 정보를 제공하는 메타데이터 역할만 수행한다.

- **Token & Type Definitions:**
  - 의존성 주입의 키로 사용되는 토큰과 타입 정의를 포함한다.

### 💎 Core - @bunner/core

DI와 직접적으로 관련된 런타임 로직은 거의 없으나, 라이프사이클 관리와 연동된다.

- **Lifecycle Hooks:**
  - 생성된 인스턴스들의 초기화(`onModuleInit`) 및 종료(`onModuleDestroy`) 시점을 관리한다.
  - 의존성 그래프의 역순으로 종료 훅을 실행하여 안전한 리소스 해제를 보장한다.
