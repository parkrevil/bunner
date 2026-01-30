# SPEC 템플릿

이 템플릿은 형식(Form)만 강제한다.
이 템플릿은 프로젝트 가정, 파일 경로, 식별자, 아키텍처, 도구, 정책 의미를 포함해서는 안 된다(MUST NOT).

---

## 0. 정체성(Identity) (REQUIRED)

| 필드(Field)      | 값(Value)                         |
| ---------------- | --------------------------------- |
| Title            | `[Spec Title]`                    |
| ID               | `[Spec ID]`                       |
| Version          | `[vX]`                            |
| Status           | `[Draft, Active, Retired]`        |
| Owner            | `[team / package / domain]`       |
| Uniqueness Scope | `[repo, package, spec]`           |
| Depends-On       | `[Document Reference list, none]` |
| Depended-By      | `Generated`                       |
| Supersedes       | `[Document Reference, none]`      |

문서 참조 형식(Document Reference Format) (REQUIRED):

- `doc:<SPEC_ID>`
- `path:<relative-path>`
- `url:<https-url>`

Spec ID 형식(Spec ID Format) (REQUIRED):

- Spec ID MUST match: `^[A-Z0-9\-]+$`

필드 형식 제약(Field Format Constraints) (REQUIRED):

- `Depends-On` MUST contain only Document References or `none`.
- `Supersedes` MUST contain only a single Document Reference or `none`.

제약(Constraint) (REQUIRED): 모든 `doc:<SPEC_ID>` 형태의 Document Reference는 `doc:` 접두사를 제거한 나머지 부분이 Spec ID Regex를 만족해야 한다(MUST).

Rule ID 형식(Rule ID Format) (REQUIRED):

- Rule ID는 전역 유일해야 한다(MUST).
- Rule ID는 본 섹션의 Spec `ID`를 접두사로 가져야 한다(MUST).
- 형식: `<SPEC_ID>-R-<NNN>` (예: `MY-SPEC-ID-R-001`)
- Rule ID는 4~9 섹션에서 참조되기 전에 3.3 섹션에서 먼저 선언되어야 한다(MUST).

---

## 1. 범위 잠금(Scope Lock) (REQUIRED)

### 1.1 In-Scope (REQUIRED)

이 섹션은 본 SPEC이 다루는 범위를 고정한다.

| Item     |
| -------- |
| `[item]` |

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 1.1 섹션은 최소 1개 행을 포함해야 한다(MUST).

제약(Constraint) (REQUIRED): In-Scope가 비어있는 경우, Item은 단일 행 `none`이어야 한다(MUST).

### 1.2 Out-of-Scope (REQUIRED)

| Item     |
| -------- |
| `[item]` |

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 1.2 섹션은 최소 1개 행을 포함해야 한다(MUST).

제약(Constraint) (REQUIRED): Out-of-Scope가 비어있는 경우, Item은 단일 행 `none`이어야 한다(MUST).

### 1.3 용어 정의(Definitions) (REQUIRED)

새로운 용어를 도입하지 않는 경우:

Normative: 본 SPEC은 새로운 용어를 도입하지 않는다.

용어를 도입하는 경우, 각 용어는 단일 행 정의여야 한다(MUST):

- `TERM(Term)`: single sentence definition

본 문서 내 용어 참조는 `TERM(Term)` 형식을 사용해야 한다(MUST).

제약(Constraint) (REQUIRED): 본 문서에서 사용된 모든 `TERM(Term)`는 1.3 또는 1.4 섹션에 등장해야 한다(MUST).

### 1.4 외부 용어 사용(External Terms Used) (REQUIRED)

본 SPEC이 사용하지만 다른 문서에서 정의된 용어를 나열한다.

| 용어(Term)   | 용어 키(Term Key) | 정의 위치(Defined In)  | 비고(Notes)  |
| ------------ | ----------------- | ---------------------- | ------------ |
| `TERM(Term)` | `[term-key]`      | `[Document Reference]` | `[optional]` |

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 1.4 섹션은 최소 1개 행을 포함해야 한다(MUST).

제약(Constraint) (REQUIRED): 외부 용어가 없는 경우, 1.4 테이블은 단일 행으로 아래 값을 가져야 한다(MUST).

- 용어(Term) = `none`, 용어 키(Term Key) = `none`, 정의 위치(Defined In) = `none`

---

## 2. 참고(References) (OPTIONAL)

| 참조 유형(Reference Type) | 문서(Document)  | 헤딩(Heading) |
| ------------------------- | --------------- | ------------- |
| `[type]`                  | `[path or url]` | `[Heading]`   |

---

## 3. 정적 계약(Static Contract) (REQUIRED)

이 섹션은 정적 형상(Static Shapes)과 정적 수집 제약(Static Collection Constraints)을 정의한다.
이 섹션은 구현 로직을 서술해서는 안 된다(MUST NOT).

### 3.1 Static Inputs (Collectable Forms) (REQUIRED)

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 3.1 섹션은 최소 1개 행을 포함해야 한다(MUST).

| 입력 종류(Input Kind) | 수집 출처(Collected From) | 허용 형식(Allowed Form) (token) | 리터럴 요구(Must Be Literal) (yes/no) | 해결 가능 요구(Must Be Resolvable) (yes/no) | 정규화 출력(Normalized Output) (none/string-id) |
| --------------------- | ------------------------- | ------------------------------- | ------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| `[kind]`              | `[source]`                | `[token]`                       | `no`                                  | `yes`                                       | `string-id`                                     |

### 3.1.1 Normalization Rules (REQUIRED if any Normalized Output != none)

정규화 식별자가 어떻게 산출되는지와, 만족해야 하는 불변 조건을 정의한다.
이 섹션은 결정성(determinism)과 안정성(stability)에 대한 계약이며, 구현 설명이 아니다.

| 정규화 출력(Normalized Output) |           Rule ID | 입력(Input(s)) | 출력 제약(Output Constraints) | 안정성 보장(Stability Guarantees) (token list) | 강제 레벨(Enforced Level) (token) |
| ------------------------------ | ----------------: | -------------- | ----------------------------- | ---------------------------------------------- | --------------------------------- |
| `string-id`                    | `[Spec ID]-R-001` | `[inputs]`     | `[constraints]`               | `[tokens]`                                     | `build`                           |

제약(Constraint) (REQUIRED): 3.1 섹션에서 `Normalized Output != none`인 모든 행은, 3.1.1 섹션에서 동일한 `Normalized Output` 값을 갖는 최소 1개 행으로 참조되어야 한다(MUST).

### 3.2 정적 데이터 형상(Static Data Shapes) (REQUIRED)

```ts
export type ContractData = unknown;
```

### 3.3 Shape Rules (REQUIRED)

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 3.3 섹션은 최소 1개 행을 포함해야 한다(MUST).

타깃 참조 문법(Target Ref Grammar) (REQUIRED):

- `InputKind:<kind>`
- `Artifact:<name>`
- `Shape:<shape-ref>`
- `Outcome:<OUT-NNN>`
- `State:<STATE-NNN>`

제약(Constraint) (REQUIRED): 3.1 섹션의 모든 행은 3.3 섹션의 최소 1개 Rule 행에서 `InputKind:<kind>`로 참조되어야 한다(MUST).

제약(Constraint) (REQUIRED): 3.3 섹션에서 Lifecycle이 `active`인 모든 Rule ID는 6.1 또는 6.2 섹션에서 최소 1회 참조되어야 한다(MUST).

|           Rule ID | 생명주기(Lifecycle) (token) | 키워드(Keyword) | 타깃(Targets) (token list) | 타깃 참조(Target Ref(s)) | 조건(Condition) (boolean, declarative) | 강제 레벨(Enforced Level) (token) |
| ----------------: | --------------------------- | --------------- | -------------------------- | ------------------------ | -------------------------------------- | --------------------------------- |
| `[Spec ID]-R-001` | `active`                    | MUST            | `inputs, artifacts`        | `[refs]`                 | `[condition]`                          | `build`                           |

노트(Note) (REQUIRED): 모든 Rule ID는 다른 섹션에서 참조되기 전에 이 섹션에서 먼저 선언되어야 한다(MUST).

노트(Note) (REQUIRED): 본 템플릿에서 "다른 섹션"은 4~9 섹션을 의미한다.

---

## 4. 아티팩트 소유(Artifact Ownership) (REQUIRED)

### 4.1 Owned Artifacts

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 4.1 섹션은 최소 1개 행을 포함해야 한다(MUST).

제약(Constraint) (REQUIRED): 4.1 섹션의 Artifact Name 값은 선언된 Uniqueness Scope 내에서 유일해야 한다(MUST).

제약(Constraint) (REQUIRED): 4.1 섹션에서 정의된 모든 Artifact Name은 3.3 또는 6.1 섹션에서 `Artifact:<name>`로 최소 1회 참조되어야 한다(MUST).

Shape Reference 형식(Shape Reference Format) (REQUIRED):

- `local:<TypeName>` (3.2 섹션에 선언된 타입명)
- `external:<Document Reference>#<Heading>`

제약(Constraint) (REQUIRED): 4.1 섹션에서 사용된 모든 Shape Reference는 3.3 섹션의 최소 1개 Rule Target Ref에서 `Shape:<shape-ref>`로 참조되어야 한다(MUST).

| 아티팩트명(Artifact Name) | 종류(Kind) (token) | 형상 참조(Shape Reference) | 쓰기 권한(Write Authority) (token) |
| ------------------------- | ------------------ | -------------------------- | ---------------------------------- |
| `[name]`                  | `[type]`           | `[shape-ref]`              | `this-spec-only`                   |

### 4.2 Referenced Artifacts

| 아티팩트명(Artifact Name) | 정의 위치(Defined In)  |
| ------------------------- | ---------------------- |
| `[name]`                  | `[Document Reference]` |

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 4.2 섹션은 최소 1개 행을 포함해야 한다(MUST).

제약(Constraint) (REQUIRED): 참조하는 아티팩트가 없는 경우, 4.2 테이블은 단일 행으로 아래 값을 가져야 한다(MUST).

- 아티팩트명(Artifact Name) = `none`, 정의 위치(Defined In) = `none`

### 4.3 No-Duplication Claim (REQUIRED)

| 여기서 정의하지 않음(Not Defined Here) |
| -------------------------------------- |
| `[concept or artifact]`                |

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 4.3 섹션은 최소 1개 행을 포함해야 한다(MUST).

제약(Constraint) (REQUIRED): 중복 방지 주장 항목이 없는 경우, 4.3 테이블은 단일 행 `none`이어야 한다(MUST).

---

## 5. 배치 및 의존 계약(Placement & Dependency Contract) (REQUIRED)

### 5.1 Placement

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 5.1 섹션은 최소 1개 행을 포함해야 한다(MUST).

제약(Constraint) (REQUIRED): 4.1 섹션에서 정의된 모든 Artifact Name은 5.1 섹션에 등장해야 한다(MUST).

| 아티팩트(Artifact) | 패턴 종류(Pattern Kind) (token) | 위치(Location) (pattern) | 집행(Enforced By) (token) | 수동 사유(Manual Reason) (required if manual) | 자동화 계획(Automation Plan) (required if manual) | 만료(Expiry) (required if manual) |
| ------------------ | ------------------------------- | ------------------------ | ------------------------- | --------------------------------------------- | ------------------------------------------------- | --------------------------------- |
| `[name]`           | `glob`                          | `[pattern]`              | `build`                   | `n/a`                                         | `n/a`                                             | `n/a`                             |

제약(Constraint) (REQUIRED): `Enforced By = manual`인 모든 행은 아래 조건을 모두 만족해야 한다(MUST).

- `Manual Reason != n/a`
- `Automation Plan != n/a`
- `Expiry != n/a` 그리고 `Expiry`는 Expiry Date Regex를 만족

### 5.2 Dependency

| 의존 규칙(Dependency Rule) | 참조 아티팩트(Referenced Artifact Ref(s)) | 허용(Allowed) | 금지(Forbidden) | 집행(Enforced By) (token) | 수동 사유(Manual Reason) (required if manual) |
| -------------------------- | ----------------------------------------- | ------------- | --------------- | ------------------------- | --------------------------------------------- |
| `[rule]`                   | `[refs]`                                  | `[x]`         | `[y]`           | `lint`                    | `n/a`                                         |

제약(Constraint) (REQUIRED): 4.2 섹션의 모든 Referenced Artifact는 5.2 섹션의 최소 1개 Dependency 행에 `Artifact:<name>`로 반영되어야 한다(MUST).

제약(Constraint) (REQUIRED): `Referenced Artifact Ref(s)`는 3.3 섹션의 Target Ref Grammar를 따라야 한다(MUST).

제약(Constraint) (REQUIRED): 5.2 섹션의 `Referenced Artifact Ref(s)`는 `Artifact:<name>`만 포함해야 한다(MUST).

제약(Constraint) (REQUIRED): 5.2 섹션의 `Referenced Artifact Ref(s)`에서 사용된 모든 `Artifact:<name>`는 4.2 섹션에 동일한 Artifact Name으로 존재해야 한다(MUST).

---

## 6. 관측 계약(Observable Contract) (REQUIRED)

제약(Constraint) (REQUIRED): `Target Ref(s)`는 3.3 섹션의 Target Ref Grammar를 따라야 한다(MUST).

### 6.1 Inputs → Observable Outcomes

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 6.1 섹션은 최소 1개 행을 포함해야 한다(MUST).

| 입력 조건(Input Condition) |           Rule ID | 타깃 참조(Target Ref(s)) | Outcome ID  | 관측 결과(Observable Outcome) |
| -------------------------- | ----------------: | ------------------------ | ----------- | ----------------------------- |
| `[condition]`              | `[Spec ID]-R-001` | `Artifact:<name>`        | `[OUT-001]` | `[outcome]`                   |

제약(Constraint) (REQUIRED): 6.1 섹션의 모든 Rule ID는 3.3 섹션에 선언된 Rule ID여야 한다(MUST).

제약(Constraint) (REQUIRED): 6.1 섹션의 Outcome ID는 섹션 내에서 유일해야 한다(MUST).

제약(Constraint) (REQUIRED): 3.3 섹션의 Rule Target Ref(s)에서 참조된 모든 `Outcome:<OUT-NNN>`는 6.1 섹션의 Outcome ID로 최소 1회 등장해야 한다(MUST).

### 6.2 State Conditions

| State ID      |           Rule ID | 조건(Condition) | 기대 관측(Expected Observable) (Outcome ID) |
| ------------- | ----------------: | --------------- | ------------------------------------------- |
| `[STATE-001]` | `[Spec ID]-R-001` | `[condition]`   | `[OUT-001]`                                 |

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 6.2 섹션은 최소 1개 행을 포함해야 한다(MUST).

제약(Constraint) (REQUIRED): State 조건이 없는 경우, 6.2 테이블은 단일 행으로 아래 값을 가져야 한다(MUST).

- State ID = `none`, Rule ID = `none`, 조건(Condition) = `none`, 기대 관측(Expected Observable) (Outcome ID) = `none`

제약(Constraint) (REQUIRED): 6.2 섹션의 모든 Rule ID는 3.3 섹션에 선언된 Rule ID여야 한다(MUST).

제약(Constraint) (REQUIRED): 6.2 섹션의 State ID는 섹션 내에서 유일해야 한다(MUST).

제약(Constraint) (REQUIRED): 6.2 섹션의 Expected Observable (Outcome ID)는 6.1 섹션의 Outcome ID로 존재해야 한다(MUST).

제약(Constraint) (REQUIRED): 3.3 섹션의 Rule Target Ref(s)에서 참조된 모든 `State:<STATE-NNN>`는 6.2 섹션의 State ID로 최소 1회 등장해야 한다(MUST).

---

## 7. 진단 매핑(Diagnostics Mapping) (REQUIRED)

최소 밀도 제약(Minimum Density Constraint) (REQUIRED): 7 섹션은 최소 1개 행을 포함해야 한다(MUST).

완전성 제약(Completeness Constraints) (REQUIRED):

- Every Rule ID defined in this document MUST appear in this section exactly once.
- Every row in this section MUST reference a Rule ID defined in this document.

제약(Constraint) (REQUIRED): Enforced Level이 build인 경우, Severity는 error 또는 fatal이어야 한다(MUST).

|           Rule ID | 위반 조건(Violation Condition) | Diagnostic Code | 심각도(Severity) (token) | 위치(Where) (token) | 탐지 방법(How Detectable) (token) |
| ----------------: | ------------------------------ | --------------- | ------------------------ | ------------------- | --------------------------------- |
| `[Spec ID]-R-001` | `[condition]`                  | `[code]`        | `[severity]`             | `[where]`           | `[detect]`                        |

---

## 8. 위반 매트릭스(Violation Matrix) (REQUIRED)

| 위반 유형(Violation Type) (token) | 조건(Condition)                           |
| --------------------------------- | ----------------------------------------- |
| `build`                           | Static Contract violation                 |
| `runtime`                         | Observable Contract violation             |
| `test`                            | Non-deterministic or inconsistent outcome |

---

## 9. 인계(Handoff) (OPTIONAL)

| From     | To Document            |
| -------- | ---------------------- |
| `[item]` | `[Document Reference]` |

---

## 10. 토큰 세트(Token Sets) (REQUIRED)

다음 토큰 세트는 이 템플릿에 대해 규범적이다.

| 토큰 필드(Token Field) | 허용 값(Allowed Values)                                         |
| ---------------------- | --------------------------------------------------------------- |
| Enforced By            | `build, lint, test, manual`                                     |
| Enforced Level         | `build, runtime, test`                                          |
| Severity               | `trace, debug, info, warning, error, fatal`                     |
| Where                  | `file, symbol, range`                                           |
| How Detectable         | `static:ast, static:artifact, runtime:observation, test:assert` |
| Write Authority        | `this-spec-only, shared`                                        |
| Uniqueness Scope       | `repo, package, spec`                                           |
| Document Reference     | `doc:<SPEC_ID>, path:<relative-path>, url:<https-url>`          |
| Pattern Kind           | `glob, regex`                                                   |
| Rule Lifecycle         | `active, retired`                                               |
| Rule Targets           | `inputs, artifacts, shapes, outcomes, state`                    |
| Term Reference Marker  | `TERM(Term)`                                                    |
| Term Key               | `kebab-case (lowercase + digits + hyphen)`                      |
| Boolean                | `true, false`                                                   |
| Yes/No                 | `yes, no`                                                       |
| Normalized Output      | `none, string-id`                                               |

형식 제약(Format Constraints) (REQUIRED):

- Spec ID Regex: `^[A-Z0-9\-]+$`
- Rule ID Regex: `^[A-Z0-9\-]+-R-[0-9]{3}$`
- Artifact Name Regex: `^[A-Za-z0-9\-_]+$`
- Outcome ID Regex: `^OUT-[0-9]{3}$`
- State ID Regex: `^STATE-[0-9]{3}$`
- Expiry Date Regex: `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`
