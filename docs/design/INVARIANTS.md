# INVARIANTS: Bunner의 불변의 법칙

> **⚠️ Non-SSOT: 이 문서는 판정 기준이 아닙니다.**
> 이 문서는 아키텍처 결정의 **철학적 배경/근거(Rationale)**를 설명합니다.
> 실제 판정 SSOT는 [ARCHITECTURE.md](../../ARCHITECTURE.md)와 [docs/specs/spec.md](../specs/spec.md)입니다.

---

이 문서는 Bunner 프레임워크의 절대적인 제약 조건과 아키텍처 원칙을 정의합니다.
생성되거나 기여 되는 모든 코드는 반드시 이 규칙을 준수해야 합니다.

## 1. 핵심 철학: "Bun Native & AOT First"

- **런타임 리플렉션 금지:** 의존성 주입, 직렬화, 검증 로직은 반드시 **컴파일 타임(빌드 타임)**에 해결되어야 합니다. 핫 패스(Hot path)에서의 런타임 리플렉션(예: `reflect-metadata` 순회)은 엄격히 금지됩니다.
- **Bun 특화:** Node.js 호환 레이어보다는 Bun의 네이티브 API(`Bun.serve`, `Bun.write`, `ReadableStream`, `Bun.file`)를 최우선으로 사용합니다.

## 2. 의존성 주입 및 모듈

- **정적 해결 (Static Resolution):** 의존성 그래프는 빌드 타임에 결정론적으로 해결 가능해야 합니다.
- **모듈 캡슐화:** 모든 프로바이더는 `Module` 내에서 제공되어야 합니다. 명시적으로 전역(Global)으로 지정하지 않는 한 전역 상태는 금지됩니다.

## 3. 설정 관리 (Configuration)

- **엄격한 검증:** 정의된 스키마(Zod/TypeBox)에 대한 검증이 실패하면 애플리케이션은 시작되어서는 안 됩니다.
- **런타임 주입:** 설정 값은 런타임에 주입되지만(12-Factor App 준수), 스키마 구조는 빌드 타임에 확정(Freeze)됩니다.

## 4. 동시성 모델 (Concurrency Model)

- **클러스터 우선:** 수평적 확장은 Bun의 네이티브 클러스터링(`reusePort`)에 의존합니다.
- **상태 없는 워커:** `@Compute` 데코레이터를 사용하는 CPU 집약적 작업은 반드시 **상태가 없어야(Stateless)** 합니다. 워커 내부로 상태 기반 의존성(예: DB 연결)을 주입할 수 없으며, 오직 인자(Argument)만 허용됩니다.

## 5. 요청 생명주기 및 제어 흐름

- **엄격한 파이프라인:** 실행 순서는 고정됩니다: `Middleware` -> `Guard` -> `Interceptor (Pre)` -> `Pipe` -> `Controller` -> `Interceptor (Post)` -> `Filter`.
- **인자 주입 (Argument Injection):** 컨트롤러는 타입 안전성을 위해 반드시 인자 데코레이터(`@Body`, `@Query`)를 통해 데이터를 받아야 합니다. 인프라 제어가 필요한 경우가 아니라면 비즈니스 데이터 처리에 `this.context`를 사용하지 마십시오.

## 6. 데이터 및 직렬화

- **비용 없는 추상화:** DTO 변환 및 직렬화는 `JSON.stringify`의 오버헤드와 중간 객체 생성을 우회하는 **AOT 생성 함수(문자열 빌더)**를 사용해야 합니다.
- **입력 안전성:** 모든 입력값은 컨트롤러에 도달하기 전에 반드시 검증되어야 합니다.

## 7. 데이터베이스 통합

- **클래스 기반 인터페이스:** 사용자는 엔티티를 클래스로 정의하지만(DX), 기본 엔진은 반드시 **Drizzle ORM**을 사용합니다(성능).
- **AOT 하이드레이션:** DB Row(Raw JSON)에서 엔티티 인스턴스로의 매핑은 범용 매핑 라이브러리(예: `plainToClass`)가 아닌, 생성된 전용 하이드레이션 코드를 사용해야 합니다.

## 8. 에러 처리

- **표준화된 응답:** 처리되지 않은 예외와 `Result.Err`는 기본적으로 **RFC 7807** (Problem Details) 규격에 맞춰 포맷팅되어야 합니다.

## 9. 테스팅

- **격리 (Isolation):** 테스트 유틸리티(`TestContainer`)는 별도 패키지(`@bunner/testing`)로 제공되어야 하며, 프로덕션 코어 번들에 포함되어서는 안 됩니다.

## 10. 문서화

- **매니페스트 기반:** OpenAPI/AsyncAPI 명세서는 런타임 인트로스펙션이 아닌, 빌드 타임에 생성된 메타데이터 매니페스트를 기반으로 생성됩니다.

---

## 부록: ARCHITECTURE.md에서 이동된 내용 (백업)

> 아래 내용은 ARCHITECTURE.md 재구성 시 이동되었습니다.
> 원문을 그대로 보존합니다. (2024-12-31)

### Deterministic Runtime Architecture

Bunner는 빌드 시점에 모든 실행 경로와 의존성을 확정하는
결정론적 런타임 아키텍처를 따른다.

#### AOT-First

- 모든 모듈 그래프는 빌드 타임에 확정된다
- 런타임 동적 import는 허용되지 않는다

#### Frozen Execution Pipeline

- 미들웨어 및 파이프라인은 애플리케이션 시작 시점에 고정된다
- 요청 처리 중 조건적 조립은 존재하지 않는다

#### Bun-Native & Standalone

- Bun 환경을 전제로 설계된다
- HTTP 서버에 종속되지 않는다
- Worker, Cron, gRPC 서버 등 다양한 실행 환경에서 동일한 원칙으로 동작한다

---

### Directory-Driven Modularity

구조는 코드보다 디렉터리를 통해 표현된다.

- 디렉터리는 기능 단위(Feature)를 나타낸다
- 모듈 경계는 명시적으로 선언될 수 있다
- 서브 모듈은 필수가 아니라 선택이다

---

### Protocol-Agnostic Pipeline

비즈니스 코어는 프로토콜을 알지 못한다.

- 프로토콜별 처리는 어댑터 계층에서 수행된다
- 각 어댑터는 독립적인 라이프사이클을 가진다
