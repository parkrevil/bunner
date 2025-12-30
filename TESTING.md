# TESTING

## 역할

- **이 문서는 테스트 품질 기준(네이밍/격리/결정성)을 정의한다.**

---

### 테스트 규칙 요약표 (Quick Reference)

| 규칙            | 내용                          | 키워드 |
| --------------- | ----------------------------- | ------ |
| 파일명          | `*.spec.ts` 형식              | MUST   |
| describe        | 함수 1개당 1개                | MUST   |
| it 네이밍       | BDD 영어 (`should...when...`) | MUST   |
| 스코프          | 대상 함수만 검증              | MUST   |
| 외부 호출       | mock/spy 격리 의무            | MUST   |
| 1 it = 1 케이스 | 여러 케이스 혼합 금지         | MUST   |
| 결정성          | 동일 입력 → 동일 결과         | MUST   |
| 러너            | `bun test` 전용               | MUST   |

## 목적

- 테스트의 품질 기준(네이밍/격리/결정성)을 고정한다.
- “테스트가 느슨해서 우연히 통과”하는 상태를 금지한다.

## 적용 범위

- `bun test`로 실행되는 모든 테스트

## 정본/우선순위

- 최상위 정본은 [SPEC.md](SPEC.md)다.

## 테스트 무결성 (Tests as a Gate)

- 변경이 로직/행동/계약(Contract)에 영향을 준다면, 관련 테스트는 반드시 존재하거나 업데이트되어야 한다.
- 필요한 테스트가 누락되어 있고 테스트 추가가 작업 범위를 벗어난다면, 즉시 중단하고 사용자에게 지침을 요청한다.
- 실패하는 테스트를 조용히 우회하거나 삭제하는 행위는 금지한다.

## 15. 유닛 테스트 표준 (Unit Testing Standard)

이 섹션은 “권장사항”이 아니다. 위반은 즉시 수정 대상이며, 테스트가 느슨하면 그것은 곧 품질 결함이다.

1. **BDD 스타일 네이밍을 강제한다**
   - `describe`: 테스트 대상 **함수 1개당 describe 1개**만 허용한다. (하나의 describe에 여러 함수를 섞는 행위 금지)
   - `it`: 반드시 **영어 BDD 문장**으로 작성한다.
     - 기본 패턴: `it('should ...', () => { ... })`
     - 예외/실패 케이스: `it('should throw when ...', () => { ... })` 또는 `it('should return null when ...', () => { ... })`

2. **유닛 테스트는 “대상 함수 스코프”만 검증한다**
   - 테스트는 대상 함수의 입력/출력/에러/부작용(명시된 것만)을 검증한다.
   - 대상 함수 내부에서 다른 모듈로 전파되는 호출이 테스트 결과에 영향을 주면 안 된다.
   - 외부 호출(네트워크, 파일시스템, 타이머, 랜덤, 글로벌 상태, 컨테이너/DI, DB 등)을 유닛 테스트에 섞는 행위는 금지다.

3. **스파이/목킹은 선택이 아니라 의무다**
   - 대상 함수가 다른 함수/모듈을 호출한다면, 그 호출은 반드시 스파잉/목킹으로 격리해야 한다.
   - 유닛 테스트가 “우연히 통과/실패”하지 않도록, 외부로 나가는 모든 경로를 통제하라.

4. **1개의 `it`는 1개의 케이스만 검증한다**
   - 한 `it`에 여러 행동/분기/규칙을 동시에 검증하지 마라.
   - 케이스가 늘어나면 `it`를 분리하고, 어떤 규칙이 깨졌는지 실패 메시지로 즉시 드러나게 하라.

5. **엣지 케이스는 광범위하고 엄격해야 한다**
   - Happy path만 쓰고 끝내는 행위 금지.
   - Failure/edge 케이스를 의무적으로 작성하라: 빈 값, 경계값, 누락, 잘못된 타입/형태, 매우 큰 입력, 중복, 순서 변경, 예상치 못한 유니코드/특수문자, `null/undefined` 등 가능한 모든 실패 모드를 명시적으로 검증한다.

6. **테스트는 결정적(Deterministic)이어야 한다**
   - 같은 코드/같은 입력이면 항상 같은 결과가 나와야 한다.
   - 시계/랜덤/타이머 등 비결정 요소는 반드시 고정하거나 대체(mock)해야 한다.

7. **테스트는 명확한 실패 원인을 제공해야 한다**
   - 실패했을 때 “어떤 규칙이 깨졌는지” 바로 알 수 있도록, 케이스를 쪼개고 이름을 규격화하라.

8. **Bun 테스트 러너 사용을 전제로 한다**
   - 표준 실행은 `bun test`다. 다른 러너/헬퍼를 편의상 추가하지 마라(필요하면 사용자 승인 필요).

## 테스트 안티패턴 (Anti-patterns)

| 위반               | ❌ 나쁜 예                    | ✅ 올바른 방법                      |
| ------------------ | ----------------------------- | ----------------------------------- |
| 여러 함수 혼합     | 1 describe에 여러 함수 테스트 | 함수 1개당 describe 1개             |
| 비-BDD 네이밍      | `it('test1', ...)`            | `it('should return X when Y', ...)` |
| 외부 의존 미격리   | 실제 API 호출                 | mock/spy로 격리                     |
| 1 it에 여러 케이스 | expect 5개를 1 it에           | 케이스별 it 분리                    |
| Happy path만       | 성공 케이스만 테스트          | edge/failure 케이스 포함            |
| 비결정적           | `Date.now()` 직접 사용        | 시간 고정 mock                      |

## 테스트 예시 (Minimal Example)

```typescript
import { describe, expect, it, mock } from 'bun:test';

describe('calculateTotal', () => {
  // Happy path
  it('should return sum when all prices are positive', () => {
    const items = [{ price: 100 }, { price: 200 }];

    const result = calculateTotal(items);

    expect(result).toBe(300);
  });

  // Edge case: empty
  it('should return 0 when items array is empty', () => {
    const result = calculateTotal([]);

    expect(result).toBe(0);
  });

  // Failure case
  it('should throw when item has negative price', () => {
    const items = [{ price: -100 }];

    expect(() => calculateTotal(items)).toThrow();
  });
});
```

**주요 포인트:**

- `describe`: 함수 1개당 1개
- `it`: BDD 문장 (`should ... when ...`)
- Happy path + Edge case + Failure case 모두 작성
- 외부 의존은 `mock`으로 격리

상세 예시는 [STYLEGUIDE.md](STYLEGUIDE.md)의 유닛 테스트 예시 참조.

## 테스트 작성 체크리스트

- [ ] 파일명이 `*.spec.ts` 형식인가?
- [ ] `describe`가 함수 1개당 1개인가?
- [ ] `it` 이름이 BDD 형식(`should...when...`)인가?
- [ ] 대상 함수의 스코프만 검증하는가?
- [ ] 외부 호출을 mock/spy로 격리했는가?
- [ ] 1 it = 1 케이스를 준수하는가?
- [ ] Happy path + Edge case + Failure case가 모두 있는가?
- [ ] 비결정 요소(시간/랜덤)를 고정했는가?
- [ ] `bun test`로 실행이 통과하는가?
