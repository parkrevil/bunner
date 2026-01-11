# SAFEGUARDS

## 역할

- 이 문서는 폭주 방지, 대량 수정 제한, 실패/중단/롤백 기준을 정의한다.

## 목적

- 에이전트/자동화가 안전장치를 우회하는 것을 방지한다.
- 실패 시 "어디까지가 허용 가능한가"를 명시해 즉시 중단/롤백을 가능하게 한다.

## 적용 범위

- 문서/코드 변경을 수반하는 모든 자동화 및 에이전트 작업

## 관련 문서

- 위반 시 즉시 중단(보안/법적/핵심 불변조건): [POLICY.md](POLICY.md)
- 승인/승격(거버넌스): [OVERVIEW.md](OVERVIEW.md)
- 에이전트 집행 규칙: [AGENTS.md](../../AGENTS.md)

## POLICY vs SAFEGUARDS 역할 구분

|            | POLICY                            | SAFEGUARDS (본 문서)        |
| ---------- | --------------------------------- | --------------------------- |
| **트리거** | 단일 위반으로 즉시 발동           | 패턴/반복으로 발동          |
| **관심사** | 절대 금지 (보안/AOT/경계/계약)    | 폭주 방지 (반복/대량 변경)  |
| **예시**   | deep import 1회, reflect-metadata | 동일 구간 3회 수정 반복     |
| **결과**   | 변경 즉시 거부                    | 중단 후 승인 요청 또는 롤백 |

---

## Safeguard 형식 (Normative)

Safeguard는 아래 형식으로만 정의한다(MUST).

```text
If <Violation> is true,
then <Enforcement> MUST occur.
```

여기서 `<Violation>`은 boolean으로 판정 가능해야 한다(MUST).

## Enforced Safeguards (Decidable)

### SG-THRASH-001: Thrashing

If thrashing is detected,
then STOP MUST occur.

- Violation (thrashing): 최근 10회 수정 내역에서 동일 구간(시작 라인 기준 ±5줄 범위)이 왕복 3회 이상
- Enforcement: STOP + decision request (승인 아티팩트는 [OVERVIEW.md](OVERVIEW.md)의 정의를 따른다)

### SG-SCOPE-001: Scope override required

If a change touches a file/package outside the user-approved scope,
then STOP MUST occur.

- Violation: 변경 대상이 사용자 승인 범위를 벗어남
- Enforcement: STOP (승인 아티팩트 없이는 진행 불가)

### SG-VERIFY-001: Verify failure

If `verify` fails and the failure cannot be fixed within approved scope,
then ROLLBACK MUST occur.

- Violation: `bun run verify` 실패 + 범위 내 해결 불가
- Enforcement: ROLLBACK

### SG-FACADE-001: Public Facade contract break

If a Public Facade change is detected without approval artifact,
then STOP MUST occur.

- Violation: `packages/*/index.ts` export 변경 + 승인 아티팩트 없음
- Enforcement: STOP

---

## Non-Enforced Safeguards (Invalid)

아래 항목들은 임계값/판정 기준이 정의되지 않아(비판정형) 집행에 사용할 수 없다(MUST NOT).
필요하면 boolean 조건으로 재정의한 뒤, Enforced Safeguards로 승격해야 한다(MUST).

- “많은 파일 동시 변경”
- “포맷팅-only 대량 변경”
- “리팩토링 + 기능 변경 혼합”

## 용어 정의

### Thrashing (스래싱)

동일 파일의 동일 라인 범위(±5줄)에서 **변경→되돌림 사이클이 3회 이상 반복**되는 상태

**판정 기준:**

- 최근 10회 수정 내역에서 동일 구간 왕복이 3회 이상이면 thrashing
- "동일 구간": 시작 라인 기준 ±5줄 범위가 겹치는 경우

**예시:**

```text
1차: 라인 50-60을 A 방식으로 수정
2차: 라인 50-60을 B 방식으로 수정 (실패로 방향 전환)
3차: 라인 50-60을 다시 A 방식으로 수정 ← thrashing 발생
```

**thrashing 발생 시 행동:**

1. 즉시 중단
2. 시도한 접근 방식들 요약
3. 사용자에게 방향 확인 요청

---

## 집행 (Enforcement)

- 에이전트(E0): 위반 감지 시 STOP/ROLLBACK을 수행한다.
- CI: 위반 감지 시 FAIL로 병합을 차단한다.
