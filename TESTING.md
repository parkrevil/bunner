# TESTING

## 1. 개요 및 원칙 (Overview & Principles)

이 문서는 **Bunner** 프로젝트의 테스트 작성, 유지보수, 실행에 관한 **단일 진실 공급원(Single Source of Truth, SSOT)**이다.
본 문서에 기술된 규칙은 권장 사항이 아니며, 모든 기여자(Human/Agent)가 준수해야 할 **강제적 규범**이다.

### 1.1 핵심 철학 (Core Philosophy)
1.  **신뢰성 (Reliability)**: 테스트는 거짓 양성(False Positive)이나 거짓 음성(False Negative) 없이 코드의 상태를 정확히 반영해야 한다. "가끔 실패하는(Flaky)" 테스트는 즉시 삭제하거나 수정해야 한다.
2.  **격리성 (Isolation)**: 각 테스트 케이스는 독립적이어야 하며, 실행 순서나 타 테스트의 상태 변경에 영향을 받아서는 안 된다.
3.  **결정성 (Determinism)**: 동일한 코드와 동일한 입력에 대해서는 언제, 어디서 실행하든 100% 동일한 결과가 보장되어야 한다.
4.  **속도 (Speed)**: 테스트 스위트는 개발 루프의 일부다. 느린 테스트(특히 유닛 테스트)는 개발 생산성을 저해하므로 최적화되어야 한다.

---

## 2. 테스트 피라미드 및 구조 (Test Structure)

프로젝트는 명확하게 구분된 세 가지 계층의 테스트를 유지한다. 각 계층의 역할과 범위를 혼합하는 것은 엄격히 금지된다.

| 계층 | 파일 패턴 | 위치 | 목적 | 외부 의존성 | Mocking 규칙 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Unit** | `*.spec.ts` | 소스 코드와 동일 위치 (Colocated) | 단일 함수/클래스의 로직 검증 | **절대 금지** (No I/O) | **모두 Mocking** (DB, Net, FS 포함) |
| **Integration** | `*.test.ts` | `test/integration/` | 모듈 간 상호작용 검증 | 허용 (DB, Redis 등) | 3rd Party API만 Mocking |
| **E2E** | `*.e2e.test.ts` | `test/e2e/` | 최종 사용자 시나리오 검증 | 허용 (실제 환경 유사) | 원칙적 금지 (제어 불가능한 외부 API 제외) |

---

## 3. 유닛 테스트 (Unit Tests)

유닛 테스트는 가장 낮은 레벨에서 개별 컴포넌트(함수, 클래스)의 **순수 로직**을 검증한다.

### 3.1 작성 규칙
1.  **범위 (Scope)**: 테스트 대상(SUT, System Under Test)은 오직 하나의 함수나 클래스여야 한다. SUT가 의존하는 모든 협력 객체(Collaborator)는 Mock 또는 Spy로 대체해야 한다.
2.  **격리 (Isolation)**: 파일 시스템, 네트워크, 데이터베이스, 시스템 시간 등 외부 상태에 의존하는 코드는 반드시 Mocking 처리하여 순수한 로직만 남겨야 한다.
3.  **커버리지 (Coverage)**: 유틸리티 함수, 헬퍼, 코어 알고리즘은 **분기 커버리지(Branch Coverage) 100%**를 지향해야 한다.
4.  **Happy Path & Edge Cases**: 정상 동작뿐만 아니라 `null`, `undefined`, 빈 값, 경계값 등 예외 케이스를 반드시 포함해야 한다.

### 3.2 금지 사항 (Forbidden)
- 실제 DB 연결 시도.
- 실제 HTTP 요청 전송.
- `sleep()`이나 `setTimeout()`을 이용한 타이밍 제어 (Bun의 Time mock 기능 사용 필수).
- 테스트 간 상태 공유 (전역 변수 사용 금지).

### 3.3 예시 (Example)
```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { UserService } from "./user.service";

describe("UserService", () => {
  let service: UserService;
  let mockRepo: any;

  beforeEach(() => {
    // 의존성 Mocking
    mockRepo = {
      findById: mock(() => Promise.resolve(null)),
    };
    service = new UserService(mockRepo);
  });

  describe("getUser", () => {
    it("should throw NotFoundError when user does not exist", async () => {
      // Arrange
      mockRepo.findById.mockResolvedValue(null);

      // Act & Assert
      expect(service.getUser(1)).rejects.toThrow("NotFound");
    });
  });
});
```

---

## 4. 통합 테스트 (Integration Tests)

통합 테스트는 두 개 이상의 모듈(예: Controller + Service, Service + DB)이 올바르게 협력하는지 검증한다.

### 4.1 작성 규칙
1.  **위치**: 반드시 `test/integration/` 디렉토리 내에 작성한다.
2.  **범위**: 주요 파이프라인(Middleware -> Controller -> Service)의 연결성을 확인한다.
3.  **데이터베이스**: 인메모리 DB(SQLite)나 Dockerized DB를 사용하여 실제 쿼리가 수행되도록 한다. 테스트 종료 후 트랜잭션 롤백이나 데이터 초기화(Teardown)가 필수다.
4.  **Mocking**: 내부 서비스 간 호출은 실제 객체를 사용하되, 제어할 수 없는 외부 시스템(결제 게이트웨이, 이메일 서버 등)은 Mocking한다.

---

## 5. E2E 테스트 (End-to-End Tests)

E2E 테스트는 시스템을 블랙박스로 취급하여, 외부 요청부터 응답까지의 전체 흐름을 검증한다.

### 5.1 작성 규칙
1.  **위치**: 반드시 `test/e2e/` 디렉토리 내에 작성한다.
2.  **접근 방식**: 내부 구현 상세(클래스 구조, DB 스키마 등)를 알지 못한다고 가정한다. 오직 공개된 API 엔드포인트(HTTP)를 통해서만 상호작용한다.
3.  **환경**: 실제 프로덕션과 유사한 스테이징 환경 또는 격리된 컨테이너 환경에서 실행한다.
4.  **시나리오**: 단순 API 호출이 아닌, "회원가입 -> 로그인 -> 글쓰기"와 같은 유저 시나리오를 검증한다.

---

## 6. 공통 코딩 표준 (Coding Standards)

모든 테스트 코드는 프로덕션 코드와 동일한 수준의 품질로 관리되어야 한다.

### 6.1 네이밍 컨벤션 (Naming Convention)
- **Describe**: 테스트 대상(클래스명, 함수명)을 명확히 명시한다.
- **It**: BDD 스타일을 준수한다. `should [expected behavior] when [condition]` 형식을 따른다.
    - ✅ `it("should return 200 OK when payload is valid")`
    - ❌ `it("test create")`
    - ❌ `it("works")`

### 6.2 구조 (Structure) - AAA 패턴
모든 테스트 케이스는 **AAA (Arrange, Act, Assert)** 주석을 명시하거나, 빈 줄로 구획을 나누어 가독성을 높여야 한다.

```typescript
it("should calculate total price", () => {
  // Arrange (준비)
  const items = [{ price: 100 }, { price: 200 }];

  // Act (실행)
  const total = calculateTotal(items);

  // Assert (검증)
  expect(total).toBe(300);
});
```

### 6.3 타입 안전성 (Type Safety)
- 테스트 코드 내에서도 `any` 사용을 엄격히 제한한다.
- Mock 객체 생성 시에도 타입 호환성을 유지해야 한다 (`as unknown as Type` 패턴은 최소화).

### 6.4 에러 검증
- 예외가 발생하는지 확인할 때는 단순히 `toThrow()`만 사용하지 말고, 구체적인 에러 타입이나 메시지를 검증해야 한다.
    - ✅ `expect(() => fn()).toThrow(ValidationError)`
    - ❌ `expect(() => fn()).toThrow()` (너무 포괄적임)

---

## 7. 실행 및 CI (Execution & CI)

### 7.1 명령어
- **전체 테스트**: `bun test`
- **유닛 테스트만**: `bun test .spec.ts`
- **커버리지 확인**: `bun test --coverage`

### 7.2 CI 정책
- PR 제출 전 로컬에서 모든 테스트가 통과해야 한다.
- 커버리지가 급격히 하락하는 PR은 병합이 차단될 수 있다.
