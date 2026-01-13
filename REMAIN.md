# REMAIN (Open Problems / Reasons / Resolutions)

---

> - 형식: **문제 → 이유 → 해결방안(=추가로 고정해야 할 계약/결정이 필요한 질문)**
> - 범위: App → Module → Adapter → Controller/Handler → Injectable/DI → Middleware/Guard/Pipe → Error Filter → Config Loading

---

## 0. 전제(현 상태에서 이미 일관된 큰 방향)

- 빌드 타임에 구조 판정이 완료되고 런타임은 정적 wiring만 실행해야 한다.
  - 근거: docs/10_FOUNDATION/INVARIANTS.md, docs/20_ARCHITECTURE/ARCHITECTURE.md
- 정상 실행 경로는 값 흐름(Result)이며, throw(Panic)는 단일화된 Error Filter Chain으로 수렴시킨다.
  - 근거: docs/30_SPEC/common.spec.md, docs/30_SPEC/execution.spec.md, docs/30_SPEC/error-handling.spec.md
- App 표면(create/start/stop/get/attachAdapter)은 Result를 반환하지 않고, 실패는 throw로 관측한다. 단 stop은 non-throw.
  - 근거: docs/30_SPEC/app.spec.md

---

## 2. Pipeline 구성 입력의 병합 규칙 부재(Controller/Module/Adapter 간 합성)

### 2.1 문제

Pipeline 구성에 관여하는 입력 채널이 여러 개 존재하지만, 최종적으로 `pipeline.middlewares/guards/pipes/handler/errorFilters`가 어떻게 “합성”되는지 계약이 닫혀있지 않다.

- 모듈 루트 파일에서 adapter별 등록 입력
  - 근거: docs/30_SPEC/module-system.spec.md (`adapters[adapterId].middlewares/guards/pipes/errorFilters`)
- 컨트롤러/핸들러 레벨의 공통 데코레이터 선언
  - 근거: docs/30_SPEC/common.spec.md (`@Middlewares/@Guards/@Pipes/@ErrorFilters`)
- 어댑터의 정적 Pipeline 선언 자체
  - 근거: docs/30_SPEC/adapter.spec.md (Adapter Static Spec / Pipeline / Error Filter Chain)

### 2.2 이유

- 동일 기능을 서로 다른 곳에 등록할 수 있는데 중복/충돌/우선순위 규칙이 없으면:
  - 어떤 순서로 실행되는지 결정적이지 않거나
  - 사용자 기대와 다른 실행이 발생할 수 있고
  - “추측 기반 결합”이 구현으로 들어갈 위험이 있다(= L1 위반 가능성).

### 2.3 해결방안(추가 계약)

- "입력 소스별 우선순위"를 고정해야 한다.
  - 예: Module registry가 controller decorator보다 우선인지, 반대인지, 또는 둘 다 합치되 deterministic ordering rule을 어떻게 만들지.
- "중복 제거" 기준(동일 FactoryRef가 여러 번 나오면 1회만 실행인지/중복 실행인지)을 고정해야 한다.
- error filter chain 구성도 동일하게(모듈/데코레이터/어댑터 선언 간) 병합 규칙을 고정해야 한다.

---

## 3. Controller/Handler 엔트리 선언 계약의 구체 SSOT 부재

### 3.1 문제

- adapter.spec.md는 Controller의 소속 어댑터 판정과 “엔트리 선언 수집 가능성”을 요구하지만,
  - 어떤 데코레이터/형식이 엔트리 선언인지
  - handler 후보를 어떻게 수집하고
  - handlerCandidates / boundHandlers에서 말하는 ‘핸들러’의 단위가 무엇인지
    를 SSOT로 고정한 문서가 없다.

### 3.2 이유

- AOT 수집이 “가능해야 한다”만으로는 구현 간 편차가 크다.
- DevTools 정적 그래프/런타임 리포트가 교차비교하려면 동일한 단위의 식별이 필요하다.

### 3.3 해결방안(추가 계약)

- 엔트리 선언(Controller/Handler)용 데코레이터 집합 및 적용 위치(클래스/메서드/파라미터)를 SSOT로 고정.
- 수집 결과 스키마(예: ControllerDeclaration / HandlerDeclaration)를 고정.
- HandlerId를 생성하기 위한 `<file>`/`<symbol>` 산출 규칙을 수집 스키마와 함께 닫기.
  - 현재 HandlerId 형식 자체는 diagnostics.spec.md에 정의되어 있으나, “symbol 산출 규칙”은 AST 수집 규칙과 함께 고정할 필요가 있다.

---

## 4. Middleware Lifecycle / Phase 키 불일치 처리 규칙

### 4.1 문제

- module-system.spec.md는 `MiddlewareLifecycleId`를 string으로 정규화 가능해야 한다고 정의하고,
- adapter.spec.md는 어댑터가 Middleware Lifecycle을 정의해야 한다고 한다.

하지만 “모듈이 등록한 lifecycle id가 어댑터가 정의한 lifecycle에 존재하지 않을 때”의 처리가 고정되어 있지 않다.

### 4.2 이유

- 이 처리가 정의되지 않으면, 구현자가 무시/에러/경고 중 임의 선택하게 된다.
- 특히 L1의 "Explicitness Over Guesses" 때문에, 모호하거나 잘못된 키는 일반적으로 빌드 실패로 귀결되어야 할 가능성이 높다(하지만 현재 계약에 명시가 없다).

### 4.3 해결방안(추가 계약)

- 어댑터가 제공하는 lifecycle id 목록의 표현을 계약으로 고정.
- 존재하지 않는 lifecycle id가 module registry에 등장할 때의 결과(빌드 실패/진단 코드/메시지 최소 형상)를 고정.

---

## 5. Panic(throw) 처리 문장 충돌 가능성(해석 위험)

### 5.1 문제

- error-handling.spec.md는
  - Panic(throw)은 Error Filter Chain으로 Result로 변환되어야 한다(MUST)
  - Panic을 값 흐름으로 전달해서는 안 된다(MUST NOT)
    를 동시에 말한다.

### 5.2 이유

- 의도는 “panic 자체를 값으로 흘리지 말고, 경계에서 catch→Result로 수렴”이지만,
  문장만 보면 “변환 자체도 금지”로 오독될 여지가 있다.

### 5.3 해결방안(추가 계약)

- "값 흐름으로 전달"의 의미를 더 좁게 정의(예: pipeline step이 Error 대신 throw를 리턴값으로 포장하는 행위 금지 등).
- Error Filter Chain이 산출하는 Result의 정확한 관계(어떤 순간부터 값 흐름으로 취급되는지)를 1문장으로 닫기.

---

## 6. Result 마커 충돌 가능성(런타임 판정 모호)

### 6.1 문제

- common.spec.md에서 Error는 `__bunner_error__` 마커로 식별된다.
- 그러나 성공 값이 object이고 우연히 동일 키를 포함하는 경우의 처리 규칙이 문서에 없다.

### 6.2 이유

- 어댑터가 Result를 프로토콜 표현으로 변환해야 하므로(adapter.spec.md), 런타임에서 Success/Error 판정이 필요하다.
- 마커 충돌 시 판정이 모호해질 수 있다.

### 6.3 해결방안(추가 계약)

- 성공 값이 object일 때 마커 키가 존재하면 이를 금지/에러로 판정하는지,
  또는 Error 판정에 추가 조건을 요구하는지(예: 값이 object && **bunner_error** === true) 등을 계약으로 고정.

---

## 9. 남은 결정/질문 체크리스트

- Pipeline 합성
  - module registry vs decorator vs adapter static spec의 우선순위/병합은?
  - 중복 제거 기준은?

- Entry 수집
  - controller/handler 엔트리 선언의 SSOT 문서는 어디에 둘 것인가?
  - HandlerId의 `<symbol>` 산출 규칙을 어디에 고정할 것인가?
