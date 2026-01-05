# TESTING

## 1. 개요 및 원칙 (Overview & Principles)

이 문서는 **Bunner** 프로젝트의 테스트 작성, 유지보수, 실행에 관한 **단일 진실 공급원(Single Source of Truth, SSOT)**이다.
본 문서에 기술된 규칙은 권장 사항이 아니며, 모든 기여자(Human/Agent)가 준수해야 할 **강제적 규범**이다.

### 1.1 핵심 철학 (Core Philosophy)
1.  **신뢰성 (Reliability)**: 테스트는 거짓 양성(False Positive)이나 거짓 음성(False Negative) 없이 코드의 상태를 정확히 반영해야 한다. "가끔 실패하는(Flaky)" 테스트는 즉시 삭제하거나 수정해야 한다.
2.  **격리성 (Isolation)**: 각 테스트 케이스는 독립적이어야 하며, 실행 순서나 타 테스트의 상태 변경에 영향을 받아서는 안 된다.
3.  **결정성 (Determinism)**: 동일한 코드와 동일한 입력에 대해서는 언제, 어디서 실행하든 100% 동일한 결과가 보장되어야 한다.
4.  **속도 (Speed)**: 테스트 스위트는 개발 루프의 일부다. 느린 테스트(특히 유닛 테스트)는 개발 생산성을 저해하므로 최적화되어야 한다.
5.  **목적성 (Purpose)**: 테스트를 통과하기 위한 테스트 코드는 작성하지 않는다. 실제 비즈니스 로직과 요구사항을 검증하기 위한 코드를 작성한다.

---

## 2. 테스트 환경 및 실행 (Environment & Execution)

### 2.1 테스트 러너 (Test Runner)
- **Bun Test**: 프로젝트는 `bun test`를 표준 러너로 사용한다. Jest, Mocha 등 타 러너 사용은 금지한다.
- **실행 명령어**:
    - 전체 테스트: `bun test`
    - 커버리지 측정: `bun test --coverage`
    - 특정 파일 실행: `bun test <file-path>`

### 2.2 라이프사이클 훅 (Lifecycle Hooks)
Bun Test가 제공하는 표준 훅을 최대한 활용하여 테스트 전후 상태를 관리한다.
- `beforeAll(() => { ... })`: 테스트 파일(Suite) 전체 실행 전 1회 수행 (DB 연결, 서버 시작 등).
- `afterAll(() => { ... })`: 테스트 파일 전체 실행 후 1회 수행 (DB 연결 해제, 파일 정리 등).
- `beforeEach(() => { ... })`: 각 `it` 실행 직전 수행 (상태 초기화, Mock 리셋).
- `afterEach(() => { ... })`: 각 `it` 실행 직후 수행 (임시 데이터 삭제 등).

---

## 3. 테스트 계층 구조 (Test Pyramid)

| 계층 | 파일 패턴 | 위치 | 목적 | Mocking 전략 |
| :--- | :--- | :--- | :--- | :--- |
| **Unit** | `*.spec.ts` | 소스 코드와 동일 위치 (Colocated) | 단일 함수/클래스의 로직 검증 | **Strict Mocking** (외부 의존성 전면 차단) |
| **Integration** | `*.test.ts` | `test/integration/` | 모듈 간 상호작용 및 파이프라인 검증 | 3rd Party API만 Mocking (DB는 실제/인메모리 사용) |
| **E2E** | `*.e2e.test.ts` | `test/e2e/` | 최종 사용자 시나리오 검증 (Black-box) | 원칙적 금지 (제어 불가능한 외부 API 제외) |

---

## 4. 상세 작성 규칙 (Detailed Guidelines)

### 4.1 유닛 테스트 (Unit Tests)
- **범위**: 테스트 대상(SUT)은 오직 하나의 함수나 클래스여야 한다.
- **Strict Mocking**: SUT 내부에서 호출되는 **모든** 외부 의존성(다른 클래스, 모듈, 네트워크, DB 등)은 반드시 `mock` 또는 `spyOn`을 사용하여 격리해야 한다. 실제 구현체를 주입하는 것은 금지된다 (DTO/Value Object 제외).
- **White-box Testing**: 내부 로직 분기를 검증하기 위해 내부 상태에 접근하는 것이 허용되나, 가능한 공개 인터페이스를 통해 검증하는 것을 권장한다.

### 4.2 통합 테스트 (Integration Tests)
- **Public API Testing**: 모듈의 내부 구현(private method)을 직접 호출하지 않는다. 반드시 모듈의 **Public API**를 통해서만 상호작용한다.
    - *규칙*: 테스트 시나리오 검증에 필요한 Public API가 없다면, `test-only` 메서드를 뚫는 대신 모듈 설계를 재검토하여 정당한 Public API를 보강해야 한다.
- **디렉토리 구조**: 테스트 파일이 비대해지거나 도메인이 복잡할 경우, 단일 파일 대신 디렉토리로 묶는다.
    - 예: `test/integration/orders/create-order.test.ts`, `test/integration/orders/cancel-order.test.ts`

### 4.3 E2E 테스트 (End-to-End Tests)
- **Black-box Testing**: 시스템 내부 구조(DB 스키마, 클래스 명 등)를 전혀 모른다고 가정한다. HTTP 요청/응답 만으로 검증한다.
- **시나리오 중심**: 단순 기능 점검이 아닌, 사용자 시나리오(User Journey)를 기반으로 작성한다.

---

## 5. 코딩 표준 및 스타일 (Coding Standards)

### 5.1 네이밍 컨벤션 (Naming - BDD Style)
- **describe**: 테스트 대상(Class, Module) 또는 기능(Method)의 이름을 명확히 기술한다. 중첩 구조를 활용한다.
- **it**: 반드시 **BDD 스타일**(`should ... when ...`)을 따른다. "테스트가 무엇을 검증하는지"가 아니라 "시스템이 어떻게 행동해야 하는지"를 서술한다.
    - ✅ `it("should return 200 OK when the payload is valid", ...)`
    - ✅ `it("should throw ValidationError when email is missing", ...)`
    - ❌ `it("test create user", ...)`
    - ❌ `it("works", ...)`

### 5.2 코드 구조 (AAA Pattern)
모든 테스트 케이스 내부는 **AAA (Arrange, Act, Assert)** 패턴을 명시적으로 준수해야 한다. 가독성을 위해 빈 줄로 단계를 구분한다.

```typescript
describe("UserService", () => {
  describe("createUser", () => {
    it("should return the created user when input is valid", async () => {
      // Arrange (준비: 데이터 생성, Mock 설정)
      const input = { name: "Alice" };
      mockRepo.save.mockResolvedValue({ id: 1, ...input });

      // Act (실행: SUT 호출)
      const result = await userService.createUser(input);

      // Assert (검증: 결과 확인)
      expect(result).toEqual({ id: 1, name: "Alice" });
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});
```

### 5.3 데이터셋 및 Fixture 관리 (Datasets & Stubs)
- **하드코딩 지양**: 반복되는 테스트 데이터는 별도 파일로 분리한다.
- **Stubs**: 정적인 데이터셋(JSON 등)은 `test/fixtures/` 또는 `test/stubs/` 디렉토리에 위치시킨다.
- **Factories**: 동적인 데이터 생성이 필요한 경우, `test/utils/factories/` 내에 팩토리 함수를 작성하여 활용한다. (예: `createUserParams()`)

### 5.4 헬퍼 및 유틸리티 (Helpers & Utils)
- **전역 헬퍼**: 모든 테스트에서 공통으로 사용되는 유틸리티(예: `mockLogger`, `createTestApp`)는 `test/utils/`에 작성한다.
- **지역 헬퍼**: 특정 도메인에만 한정된 헬퍼는 해당 테스트 파일과 인접한 `__test_utils__` 디렉토리나 파일 내부에 작성한다.

---

## 6. 안티 패턴 (Anti-Patterns)
1.  **Logic in Tests**: 테스트 코드 내에 복잡한 조건문(`if`, `for`)이나 로직을 작성하지 않는다. 테스트는 선언적이어야 한다.
2.  **Implementation Leaking**: 프로덕션 코드를 수정할 때 테스트 코드도 함께 수정해야 한다면(깨진 테스트 복구 제외), 테스트가 구현 세부사항에 너무 의존하고 있다는 신호다.
3.  **Catching Everything**: `try-catch`로 예외를 잡고 `expect` 없이 넘어가는 행위를 금지한다. 예외 검증은 `expect(() => ...).toThrow()`를 사용한다.
4.  **Flaky Tests**: 네트워크 지연이나 실행 순서에 따라 결과가 달라지는 테스트를 방치하지 않는다.

---

## 7. 체크리스트 (Self-Check)
- [ ] 파일명 규칙(`*.spec.ts`, `*.test.ts`)을 준수했는가?
- [ ] `describe`와 `it` 네이밍이 BDD 스타일인가?
- [ ] AAA 패턴으로 구조가 명확한가?
- [ ] 유닛 테스트에서 외부 의존성을 모두 Mocking 했는가?
- [ ] 통합 테스트에서 Public API만을 사용했는가?
- [ ] 반복되는 데이터나 로직을 Fixture/Helper로 분리했는가?
- [ ] `bun test` 실행 시 경고나 에러 없이 통과하는가?
