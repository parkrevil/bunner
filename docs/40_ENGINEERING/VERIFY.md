# VERIFY

이 문서는 Bunner 프로젝트의 **검증(verify) 절차**를 정의하는 정본(SSOT)이다.

## 개요 (Overview)

`verify`는 코드 변경이 프로젝트의 기본 품질 기준을 충족하는지 확인하는 **최소 검증 단계**이다.
모든 PR, 데드코드 제거, 구조 변경 작업은 반드시 `verify`를 통과해야 한다.

> VERIFY.md는 실행 가능한 검증 절차를 정의하는 **엔지니어링 정본(L4)** 문서이며,
> 검증 대상의 “무엇을 테스트할지”가 아니라
> “무엇이 통과 기준인가”를 정의한다.

---

## 검증 명령 (Verify Command)

```bash
bun run verify
```

위 명령은 다음 검증 단계를 **순차적으로** 실행한다:

| 순서 | 단계          | 명령           | 목적                          |
| :--: | :------------ | :------------- | :---------------------------- |
|  1   | **타입 검사** | `bun run tsc`  | TypeScript 컴파일 오류 검출   |
|  2   | **린트**      | `bun run lint` | 코드 스타일 및 규칙 위반 검출 |
|  3   | **테스트**    | `bun run test` | 단위, 통합 테스트 실행        |

---

## Plan/Task 게이트 (Mechanically Enforced)

`verify`는 코드 변경이 발생한 경우, 변경이 최소 1개 이상의 Task 문서(`tasks/**`)와 연결되어 있어야 한다.

또한 Task 파일은 Plan ID 기반 디렉토리 규칙을 따른다.

```text
Rule: VFY-TASK-001
Target: tasks/**
Violation: Task 문서가 `tasks/<file>.md` 형태로 `tasks/` 루트 바로 아래에 존재함
Enforcement: block
```

```text
Rule: VFY-TASK-002
Target: tasks/**
Violation: Task 문서 경로가 `tasks/<plan-id>/**`를 따르지 않음
  - <plan-id>는 Task 내부 Plan 링크 `plans/<plan-id>.md#Step-N`에서 유도한다
Enforcement: block
```

예시:

- Plan: `plans/260126_01_firebat_pure-code-quality.md`
- Task: `tasks/260126_01_firebat_pure-code-quality/260126_01_01_report-schema-vnext.md`

### 테스트 변경 게이트 (Mechanically Enforced)

테스트 파일이 변경되는 경우, 변경이 “현재 코드에 맞춘 기대값 변경”이 아니라
명시된 계약(요구사항/스펙/정책)에 근거한 변경임을 Task 문서에서 기계적으로 추적 가능해야 한다.

```text
Rule: VFY-TST-001
Target: tasks/**
Violation: 변경된 파일 중 테스트 파일(`*.spec.ts`, `*.test.ts`, `*.e2e.test.ts`)이 1개 이상 존재하고,
  동시에 변경된 `tasks/**/*.md` 어디에도 아래 패턴의 라인이 존재하지 않음
  - Contract reference: <non-empty>
Enforcement: block
```

---

## 통과 기준 (Pass Criteria)

`verify`가 **통과**하려면 다음 조건을 **모두** 만족해야 한다:

- `tsc`: 컴파일 오류 0개
- `lint`: 린트 오류 0개
  - 기존 경고는 허용할 수 있으나,
    변경으로 인해 **새로운 경고가 추가되는 경우 verify 실패로 간주한다**.
- `test`: 모든 테스트 통과 (실패 0개)

하나라도 실패하면 `verify`는 **실패**로 간주한다.

verify 실패 시:

- 변경 사항은 병합될 수 없다.
- 실패 원인을 수정하거나 변경을 철회해야 한다.
- 실패 상태에서의 우회 병합은 정책 위반이다.

---

## 사용 시점 (When to Run)

| 상황                  | verify 필수 여부 |
| :-------------------- | :--------------- |
| PR 제출 전            | **MUST**         |
| 데드코드 제거 후      | **MUST**         |
| 구조 변경 후          | **MUST**         |
| 패키지 의존성 변경 후 | **MUST**         |
| 일반 코드 수정 후     | SHOULD           |

## 관련 문서

- [TESTING.md](TESTING.md): 테스트 작성 규칙 및 전략
- [STYLEGUIDE.md](STYLEGUIDE.md): 코드 스타일 및 린트 규칙
- [DEAD_CODE_POLICY.md](../50_GOVERNANCE/DEAD_CODE_POLICY.md): 데드코드 제거 시 verify 요구사항
