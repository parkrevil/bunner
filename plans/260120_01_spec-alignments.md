---
status: draft
---

# Run Plan

## 0) Persona / Handshake

- Persona: `@Architect`
- Handshake:
  - "페르소나 **@Architect**로서 작업을 시작합니다. **AGENTS.md (E0)**에 명시된 행동 제한 규약을 숙지하였으며, 작업 도중 불확실성 발생 시 즉시 중단(STOP IF UNCERTAIN)할 것을 서약합니다."

## 0) 원문(사용자 입력)

- 원문:
  - "합의된 모든내용을 반영할 계획을 말해라"

- 에이전트 해석(검증 가능하게):
  - 무엇을 변경하는가:
    - 합의된 방향(5/A, 10/11/JSON, 13/volatility+mutation-throws)을 L3 SPEC 문서에 규범 문장(MUST/MUST NOT)으로 반영한다.
  - 성공 조건은 무엇인가:
    - SPEC에 합의된 규범이 추가/정렬되고, DW-TERM 및 DOCS_WRITING 규칙을 위반하지 않는다.
    - 17(전역 주입)은 방향성 합의가 되기 전까지 SPEC에 반영하지 않는다.
  - 명시적 제약은 무엇인가:
    - `docs/**`는 SSOT이므로 변경은 승인 토큰 이후에만 수행한다.
    - 문서 변경은 판정형(Decidable) 규칙만 추가한다.

- SSOT 충돌 여부:
  - [ ] 없음
  - [x] 있음 → 17은 합의 전이라 문서 반영 금지(Stop if uncertain)

---

## 1) 기대효과

- “단일 파일/프레임워크-인식 대상 파일”의 범위를 기계적으로 판정 가능하게 고정한다.
- Manifest 산출물의 방향성을 JSON 데이터 계약으로 고정하여 구현 드리프트를 줄인다.
- Manifest의 휘발성(bootstrap 후 소거) + 변경 시도는 throw(불변 위반은 오류)라는 계약을 명시한다.

---

## 2) 범위(Scope) / 비범위(Non-Goals)

### Scope

- 변경 대상과 이유:
  - `docs/30_SPEC/module-system.spec.md`: “단일 파일” Violation의 입력 집합(프레임워크-인식 대상 파일) 판정 규칙을 추가해 A 기준을 계약으로 고정.
  - `docs/30_SPEC/manifest.spec.md`: Manifest 산출물 방향성(JSON)과 volatility/mutation-throws 요구를 계약으로 명시.

- 변경 유형:
  - [ ] 생성
  - [x] 수정
  - [ ] 삭제
  - [ ] 이동/병합

- 영향 범위 선언(사실 기술):
  - 영향 가능 문서: `docs/30_SPEC/module-system.spec.md`, `docs/30_SPEC/manifest.spec.md`
  - Public Facade 변경: 없음 (문서 계약만 변경)
  - 패키지 의존 변경: 없음

### Non-Goals

- 17(전역 객체를 통한 런타임 주입)의 허용/금지/형상은 아직 합의되지 않았으므로 본 작업 범위에서 SPEC에 반영하지 않는다.
  - 또한, "특정 전역 키를 사용하지 않는다" 같은 구현 디테일 선언은 SPEC에 추가하지 않는다.
  - 합의가 되더라도 SPEC에는 구현 디테일(키 이름) 대신 관측 가능한 제약(부트스트랩 이후 메타데이터 접근 경로 부재 등)만을 계약으로 추가한다.
- CLI 구현 변경은 본 작업에서 수행하지 않는다.

---

## 3) SSOT 확인 기록

- SPEC: `docs/30_SPEC/module-system.spec.md`, `docs/30_SPEC/manifest.spec.md`
- ARCHITECTURE: `docs/20_ARCHITECTURE/ARCHITECTURE.md`
- STRUCTURE: `docs/20_ARCHITECTURE/STRUCTURE.md`
- FOUNDATION: `docs/10_FOUNDATION/INVARIANTS.md`
- DOCS WRITING: `docs/50_GOVERNANCE/DOCS_WRITING.md`

---

## 4) 작업 설계(선택지/결정)

- 선택지(5번 기준):
  - A: “프레임워크-인식 대상 파일” = AOT가 의미 신호를 검출한 파일(파서 분석 성공 + 신호 ≥ 1)
  - B: “프레임워크-인식 대상 파일” = 스캔 입력 파일 전체

- 최종 결정:
  - 5는 A로 고정(사용자 합의)

- 선택지(Manifest 방향성):
  - JSON(데이터 계약) vs TS 모듈(코드 생성)

- 최종 결정:
  - JSON으로 고정(사용자 합의)

- 선택지(Manifest immutability 구현 수단):
  - 수단 비계약(결과만 계약) vs deepFreeze 같은 특정 수단 계약

- 최종 결정:
  - 수단 비계약, 결과 계약만 추가(변경 시도는 throw + bootstrap 후 접근 경로 없음)

---

## 5) 실행 계획

### Step 1) `module-system.spec.md`에 A 기준 반영

- 작업 내용:
  - “프레임워크-인식 대상 파일”의 판정 규칙을 규범 문장으로 추가한다.
  - 새로운 백틱 토큰을 도입하지 않고 문장 기반으로 작성한다.

- 중간 검증:
  - DW-TERM 위반 여부(Definitions 순수성, 새 토큰 정의 누락) 점검

- 변경 파일:
  - `docs/30_SPEC/module-system.spec.md`

### Step 2) `manifest.spec.md`에 JSON + volatility + mutation-throws 반영

- 작업 내용:
  - Manifest 산출물은 JSON(UTF-8)로 관측 가능해야 함을 MUST로 추가한다.
  - bootstrap 이후 Manifest/구조 메타데이터 접근 경로 부재(volatility)를 MUST로 추가한다.
  - bootstrap 구간 내에서라도 변경 시도는 throw로 관측되어야 함을 MUST로 추가한다.

- 중간 검증:
  - DOCS_WRITING(DW-DEC-001) 위반 표현 금지(“권장/충분히/적절히”) 점검

- 변경 파일:
  - `docs/30_SPEC/manifest.spec.md`

### Step 3) 17은 별도 논의 후 반영

- 작업 내용:
  - L1/L2 근거와 함께 권장안을 제시하고, 사용자가 허용/금지 방향을 결정하면 이후 별도 PR/작업에서 app.spec/manifest.spec 등에 반영한다.
  - 반영 시에도 구현 디테일(전역 키/변수명)을 계약으로 고정하지 않고, 관측 가능한 제약만을 추가한다.

---

## 6) 검증 / 완료 조건

- [ ] DW-TERM-001 위반 없음(새 토큰 도입/중복 정의/Definitions 순수성)
- [ ] DOCS_WRITING 위반 없음(DW-DEC-001 등)
- [ ] 변경된 규범 문장은 판정형(boolean)으로 읽을 수 있다

---

## 7) 리스크 / 롤백

- 리스크:
  - “프레임워크-인식 대상 파일”의 신호 정의가 과도하게 좁거나 넓을 수 있음

- 롤백:
  - 변경된 문장들을 제거하여 기존 SPEC로 되돌린다

---

## Plan Changes (append-only)

- (none)
