cat << 'EOF' > VISION.md

# VISION

## The Bunner Framework Vision

**Bunner**는 **Bun** 환경을 위해 설계된 런타임 독립적(Runtime-agnostic) 차세대 백엔드 프레임워크입니다.
Spring의 엔터프라이즈급 안정성, Angular의 구조적 미학, 그리고 Rust의 고성능을 결합하여 **"차세대 엔터프라이즈 표준"**을 지향합니다.

---

### 1. Core Philosophy: The Deterministic Runtime (결정론적 런타임)

우리는 런타임의 불확실성을 거부합니다. 성능과 안정성은 예측 가능성에서 나옵니다.

- **AOT-First Architecture:** AOT(Ahead-Of-Time) 컴파일을 통해 런타임 오버헤드를 제거합니다.
  - **No Dynamic Imports:** 모든 의존성과 모듈 그래프는 빌드 타임에 확정됩니다.
  - **Frozen Pipeline:** 미들웨어 체인은 시작 시점에 배열화(Arrayizing)되어 최적화됩니다. 요청마다 파이프라인을 조립하는 조건문은 존재하지 않습니다.
- **Bun-Native & Standalone:** Bun의 속도를 극한으로 활용하기 위해 설계되었습니다. HTTP에 종속되지 않으며, Worker, Cron, gRPC 서버 등 어떤 환경에서도 동일한 아키텍처 원칙(Primitives)으로 동작합니다.

---

### 2. Structure: Directory-Driven Modularity (디렉터리 기반 모듈화)

우리는 보일러플레이트 코드보다 파일 시스템의 규칙(Convention)을 신뢰합니다.

- **Implicit Module Resolution (암시적 모듈 해석):**
  - 파일 시스템이 곧 구조입니다. `__module__.ts`가 존재하는 디렉터리가 곧 모듈의 경계(Boundary)가 됩니다.
  - **Nearest Ancestor Strategy:** `@RestController`, `@Injectable` 등의 컴포넌트는 자동으로 가장 가까운 상위 모듈에 소속됩니다.
  - **Feature-First:** 서브 모듈은 필수가 아닌 선택입니다. 개발자는 '기능(Feature)' 단위로 디렉터리를 구성하고, 아키텍처적으로 격리가 필수적인 경우에만 `__module__.ts`를 통해 경계를 세웁니다.
- **Functional Dependency Injection (함수형 의존성 주입):**
  - **No Constructor Injection:** 클래스 생성자 주입 방식을 폐기하고, Angular/Vue에서 영감을 받은 함수형 `inject(Token)` 패턴을 채택하여 로직과 인스턴스화 메커니즘을 분리합니다.
  - **Compiler-Assisted Context:** 컴파일러가 `inject()` 호출 시 호출자의 컨텍스트(예: 로거의 Class Name)를 자동으로 주입하여 최상의 DX를 제공합니다.

---

### 3. Pipeline: Protocol-Agnostic & Layered (프로토콜 중립 및 계층화)

비즈니스 로직은 순수해야 하며, 프로토콜 세부 사항은 어댑터의 몫입니다.

- **Hybrid Binding Strategy:**
  - **Declarative:** 컨트롤러나 메서드 레벨에서 `@UseGuard`, `@UseMiddleware` 데코레이터를 사용하여 세밀하게 제어합니다.
  - **Global/Scope:** `__module__.ts` 설정을 통해 모듈 전체에 적용되는 광역 정책을 관리합니다.
- **Adapter-Specific Lifecycles:**
  - 미들웨어 설정은 어댑터(예: `http`, `grpc`, `ws`)별로 네임스페이스가 분리됩니다.
  - HTTP 미들웨어가 WebSocket 컨텍스트에서 오동작하는 일을 원천 차단하며, 각 어댑터는 독립적인 라이프사이클 훅을 가집니다.

---

### 4. Safety & Observability: The Hybrid Reliability Model (하이브리드 신뢰성 모델)

우리는 "Rust의 안전성"과 "TypeScript의 현실성" 사이의 가교를 놓습니다.

#### Error Handling: Containment & Conversion (격리와 변환)

- **Dual-Layer Strategy:**
  - **Domain Failure (Result Pattern):** 예측 가능한 비즈니스 실패(예: 유효성 검증, 찾을 수 없음)는 `Result<T, E>`를 반환합니다. 스택 트레이스 생성 비용을 제거합니다.
  - **System Panic (Throw):** 예측 불가능한 인프라 결함(예: DB 다운, OOM)은 `throw`를 허용합니다.
- **Containment of External Chaos (외부 혼돈의 격리):**
  - **`trySafe()` Utility:** 불안정한 서드파티 호출을 감싸서 `throw`를 `Result.Err` 혹은 통제된 패닉으로 변환합니다.
  - **Global Safety Net:** 최후방 인터셉터가 처리되지 않은 모든 `throw`를 포착하고, 전체 스택 트레이스를 로깅한 뒤 일반적인 `Internal Server Error` (System Panic)로 변환합니다.
- **Protocol-Agnostic Errors:**
  - 에러는 HTTP Status가 아닌 **Kind(종류, 예: `NOT_FOUND`)**로 정의됩니다.
  - **Adapter Mapping:** 각 어댑터는 `Map<ErrorKind, StatusCode>`를 유지하여 실패를 프로토콜에 맞는 응답으로 번역합니다.

#### Logging: Tri-State Contextual Logging (3단계 컨텍스트 로깅)

- **AsyncLocalStorage (ALS):** `ctx` 객체를 인자로 넘기지 않아도 TraceID와 JobID가 전역으로 전파되어, 독립형(Standalone) 및 워커 환경에서도 완벽한 추적을 지원합니다.
- **Tri-State Policy:**
  1. **Success (INFO):** "작업 완료."
  2. **Failure (WARN):** "비즈니스 로직 거부." (스택 트레이스 없음, 높은 신호 대 잡음비).
  3. **Panic (ERROR):** "시스템 크래시." (Full 스택 트레이스 + 원인(Cause) 포함, 즉각적인 조치 필요).

---

### 5. Developer Experience (DX) & AI Alignment (AI 정렬)

우리는 "Vibe Coding"과 AI 어시스턴트 시대를 위해 설계합니다.

- **Predictability for AI:**
  - 일관된 패턴(Directory = Feature)은 Jules나 Copilot 같은 AI 에이전트가 방대한 문서 없이도 아키텍처를 추론할 수 있게 합니다.
  - 엄격한 타입 시스템과 결합된 단순한 API(`trySafe`, `inject`)는 AI의 환각과 로직 오류를 최소화합니다.
- **Zero-Boilerplate:**
  - 복잡한 연결(Wiring)은 프레임워크가 담당합니다. 당신은 오직 **로직(Logic)**에만 집중하십시오.
    EOF
