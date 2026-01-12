# REMAIN (Open Problems / Reasons / Resolutions)

> 목적
>
> - 이 문서는 “지금 작성된 SPEC들이 자연스럽게 구현될 수 있는가?” 관점에서 남아있는 공백/모호점/과잉 스펙을 정리한다.
> - 형식: **문제 → 이유 → 해결방안(=추가로 고정해야 할 계약/결정이 필요한 질문)**
> - 범위: App → Module → Adapter → Controller/Handler → Injectable/DI → Middleware/Guard/Pipe → Error Filter → Config Loading

---

## 0. 전제(현 상태에서 이미 일관된 큰 방향)

- 빌드 타임에 구조 판정이 완료되고 런타임은 정적 wiring만 실행해야 한다.
  - 근거: docs/10_FOUNDATION/INVARIANTS.md, docs/20_ARCHITECTURE/ARCHITECTURE.md
- 정상 실행 경로는 값 흐름(Result)이며, throw(Panic)는 단일화된 Error Filter Chain으로 수렴시킨다.
  - 근거: docs/30_SPEC/common.spec.md, docs/30_SPEC/execution.spec.md, docs/30_SPEC/error-handling.spec.md
- App 표면(create/start/stop/get/applyAdapter)은 Result를 반환하지 않고, 실패는 throw로 관측한다. 단 stop은 non-throw.
  - 근거: docs/30_SPEC/app.spec.md

---

## 1. App 설정 로드(요청 추가사항 포함)

### 1.1 문제

- App이 “설정 로드(Config Loading)”를 포함해야 한다는 요구가 확정되었고, 설정은 `.env`, 클라우드 환경 변수/매니지드 설정, DB 등 다양한 소스에서 읽을 수 있어야 한다.
- 그런데 현재 계약은 `createApp`이 "Env/Config preload"를 포함하고 "preload 결과는 런타임 동안 변경되지 않아야" 한다는 수준에서 멈춘다.
  - 근거: docs/30_SPEC/app.spec.md

### 1.2 이유 (왜 이게 문제인가)

- “어떤 소스에서 어떤 순서로 읽는지”가 정의되지 않으면 구현자가 제각각 결정을 내리게 되어:
  - 동일한 앱이라도 환경에 따라 다른 결과가 나올 수 있고(결정성 저하)
  - 보안/운영 측면에서 위험한 기본값이 생길 수 있으며
  - DevTools/Diagnostics에서 관측해야 할 최소 정보가 불명확해진다.
- 또한 AOT/Manifest 기반의 정적 판정 철학과 충돌 가능성이 있다.
  - 예: DB에서 설정을 읽는다면 “런타임 I/O”를 포함하게 되는데, 이를 구조 판정 입력으로 오해하면 L1/L2의 경계를 침범할 수 있다.

### 1.3 해결방안(=추가로 고정해야 할 계약)

> 아래는 “어떤 구현이든 동일한 결론을 강제”하기 위해 문서로 고정해야 하는 항목들이다.
> (구체 선택은 이후 결정 필요)

1. **Config Loading의 경계 정의**

- `createApp` 단계에서 수행되는 Config Loading은 “구조 판정(AOT) 입력”이 아니라 “실행 전제 조건(Execution Environment Boundary)”으로 취급해야 하는지 여부를 명시.
- Config loading 실패는 `createApp` 실패(throw)로 관측되는지, 또는 `app.start`에서 실패로 관측되는지 단일화.

2. **Config Source 모델 정의**

- 설정 소스의 최소 타입 집합을 계약으로 고정:
  - `.env`(파일 기반)
  - 환경 변수(클라우드 포함)
  - 외부 시스템(예: DB/원격 설정 서비스)
- 각 소스가 “필수/선택”인지, 네트워크/DB 접근을 허용하는지(허용한다면 어느 단계에서), 타임아웃/재시도 같은 행위가 관측 가능한 의미론에 포함되는지 여부를 명시.

3. **우선순위/병합 규칙(Precedence/Merge Rules) 정의**

- 다중 소스 로드 시 key 충돌의 우선순위 규칙을 결정적으로 고정.
- 병합이 허용되는지(= deep merge) 또는 “마지막 값 wins”만 허용되는지 고정.

4. **불변성(immutability) 모델의 구체화**

- “preload 결과는 런타임 동안 변경되지 않는다”의 정확한 의미:
  - 앱 프로세스 생명주기 동안 완전 불변인지
  - 요청 컨텍스트(ContextId)별로 분기된 설정이 존재할 수 있는지(있다면 그것은 config가 아니라 request-scope provider로 분리해야 하는지)

5. **관측(DevTools/Diagnostics/Logging) 최소 계약**

- 보안상 민감 정보를 노출하지 않으면서도, 어떤 소스에서 로딩되었는지/성공했는지/실패 원인은 무엇인지 최소 관측치를 고정.
  - DevTools runtime report에 포함되는지 여부(포함한다면 “원문 옵션”처럼 unknown/raw를 허용할지)도 결정 필요.

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

## 7. App stop non-throw의 운영/관측 공백

### 7.1 문제

- app.spec.md는 `app.stop`에서 throw가 관측되면 안 된다고 고정한다.
- 하지만 stop 실패(예: 리소스 dispose 실패)를 어떻게 관측/진단할지 계약이 없다.

### 7.2 이유

- “throw 금지”가 강하면, 실패를 숨기지 않으면서도 관측 가능한 다른 경로가 필요하다.
- 현재 docs/30_SPEC/devtools.spec.md는 adapter 바인딩 관측 위주이고, stop 실패를 담는 필드가 없다.

### 7.3 해결방안(추가 계약)

- stop 중 실패를 기록하는 표준 로깅 이벤트/DevTools runtime report 확장 여부를 결정하고 최소 스키마를 고정.
- 또는 stop 실패를 “반드시 내부적으로 삼켜야 한다”가 아니라 “throw는 금지하되 진단/로그는 MUST” 같은 형태로 관측 계약을 추가(단, docs 규범 키워드 사용 시 DW-DEC 규칙 준수 필요).

---

## 8. 상태(DevTools runtime report)의 의미론 공백

### 8.1 문제

- devtools.spec.md에는 `isApplied`, `isListening` 같은 상태가 있으나, “정확히 언제 true가 되는지”를 app/applyAdapter/start 의미론과 1:1로 매핑하는 계약이 없다.

### 8.2 이유

- DevTools 산출물은 실행 의미론을 바꾸면 안 되지만, 의미가 불명확하면 소비 도구가 추측(= 금지)을 하게 된다.

### 8.3 해결방안(추가 계약)

- `app.applyAdapter` 호출(옵션 바인딩)과 `isApplied`의 관계를 명확히 고정.
- `isListening`은 “실제 리스닝 소켓이 바인딩됨” 같은 관측 가능한 이벤트와 연결해 고정.

---

## 9. 남은 결정/질문 체크리스트

- Config Loading
  - 어떤 소스들을 1st-class로 지원하는가? (.env / env / cloud config / DB)
  - 우선순위/병합 규칙은?
  - 불변성의 단위(프로세스 전체 vs 요청별)는?
  - 실패 관측은 createApp vs start 어디인가?

- Pipeline 합성
  - module registry vs decorator vs adapter static spec의 우선순위/병합은?
  - 중복 제거 기준은?

- Entry 수집
  - controller/handler 엔트리 선언의 SSOT 문서는 어디에 둘 것인가?
  - HandlerId의 `<symbol>` 산출 규칙을 어디에 고정할 것인가?

---
