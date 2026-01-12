# DOCS WRITING (Global)

## 역할

- 이 문서는 `docs/**` 전체에 적용되는 문서 작성 규율(계약)을 정의한다.
- 이 문서는 “바이브 코딩 에이전트”가 해석 없이 따를 수 있도록, 판정형(Decidable) 규칙만을 포함한다.

## 집행 (Normative)

- 에이전트가 `docs/**`를 변경할 때, 본 문서를 기준으로 위반 여부를 판정해야 한다(MUST).
- 위반이 감지되면 에이전트는 즉시 중단(STOP)하거나 변경을 차단(BLOCK)해야 한다(MUST).

## 기본 원칙 (Normative)

- 본 문서에 추가되는 모든 규칙은 판정형(Decidable)이어야 한다(MUST).
- 판정형으로 재정의할 수 없는 규칙이 필요해지면, 작업은 즉시 중단(STOP IF UNCERTAIN)되어야 한다(MUST).

## 용어 정의

### 판정형(Decidable)

이 문서에서 “판정형”은 아래 조건을 모두 만족하는 규칙을 의미한다.

- 입력(대상)이 명시되어 있다.
- 위반 상태가 boolean으로 판정 가능하다.
- 판정이 해석/취향/비유에 의존하지 않는다.

### 규범 키워드 (Normative Keywords)

이 문서에서 규범 키워드는 아래 토큰을 의미한다.

- `MUST`
- `MUST NOT`
- `MAY`

## Rules (Normative)

아래 규칙은 Rule Block 형식으로만 정의한다(MUST).

```text
Rule: <ID>
Target: <scope>
Violation: <boolean, machine-checkable>
Enforcement: block | stop
```

```text
Rule: DW-DEC-001
Target: docs/**
Violation: 변경된 라인에 규범 키워드(MUST/MUST NOT/MAY)가 포함되어 있고, 동시에 아래 문자열 중 하나가 포함됨
  - "적절히"
  - "충분히"
  - "권장"
Enforcement: block
```

```text
Rule: DW-GLOBAL-001
Target: docs/50_GOVERNANCE/DOCS_WRITING.md
Violation: 이 문서가 특정 문서군에만 적용되는 섹션/개념 키워드를 포함함
  - "Static Shape"
  - "Observable Semantics"
Enforcement: block
```

```text
Rule: DW-TERM-001
Target: docs/**
Violation: 변경된 라인에 규범 키워드가 포함되어 있고, 동시에 새로 추가된 백틱 토큰(예: `FooBar`)이 존재하지만, 동일 PR에서 아래 둘 중 어느 쪽에도 해당 토큰이 추가되지 않음
  - 상위 정본 용어집: docs/10_FOUNDATION/GLOSSARY.md
  - 변경된 문서 내부의 "Definitions" 또는 "용어 정의" 섹션
Enforcement: stop
```

```text
Rule: DW-TERM-002
Target: docs/**
Violation: 아래 "용어 정의 항목" 중 동일한 Term이 2개 이상의 파일에서 정의됨
  - GLOSSARY 항목: docs/10_FOUNDATION/GLOSSARY.md에서 `- **<Term>**:` 형태로 정의된 Term
  - Definitions 항목: docs/**의 "Definitions" 또는 "용어 정의" 섹션에서 `- <Term>:` 형태로 정의된 Term
Enforcement: block
```

```text
Rule: DW-TERM-003
Target: docs/**
Violation: docs/10_FOUNDATION/GLOSSARY.md가 아닌 파일의 "Definitions" 또는 "용어 정의" 섹션에서 정의된 Term이,
  - 동일 파일 밖의 다른 파일에도 등장하고,
  - 동시에 docs/10_FOUNDATION/GLOSSARY.md에는 정의되어 있지 않음
Enforcement: block
```

```text
Rule: DW-TERM-004
Target: docs/**
Violation: "Definitions" 또는 "용어 정의" 섹션의 정의 문장에 아래 문자열 중 하나가 포함됨
  - "동의어"
  - "별칭"
  - "alias"
  - "aka"
  - "같은 의미"
Enforcement: block
```
