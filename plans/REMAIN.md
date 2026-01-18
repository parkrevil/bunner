# REMAIN (닫아야 할 결정 / 추가 계약)

> Status: WORKING LIST (not SSOT)
>
> 본 파일은 L2 `docs/20_ARCHITECTURE/STRUCTURE.md`에 의해 `plans/` 하위에 위치한다.
> 본 파일은 SSOT 계약이 아니다. SSOT(L1–L5, 특히 L3 `docs/30_SPEC/**`) 문서에 반영되어야 할 미결정/미정의 사항을 체크리스트로 관리한다.

---

## 0. 전제(이미 큰 방향은 정렬됨)

- 빌드 타임 권위: 구조 판정은 빌드 타임에 완료되고, 런타임은 정적 wiring만 실행한다.
  - SSOT: `docs/10_FOUNDATION/INVARIANTS.md`, `docs/20_ARCHITECTURE/ARCHITECTURE.md`
- 정상 경로는 Result/값 흐름이며, Panic(throw)은 Exception Filter Chain으로 처리되어 Result로 수렴한다.
  - SSOT: `docs/30_SPEC/common.spec.md`, `docs/30_SPEC/execution.spec.md`, `docs/30_SPEC/error-handling.spec.md`
- App 표면(`createApplication/start/stop/get/attachAdapter`)은 Result를 반환하지 않고, 실패는 throw로 관측된다. (`app.stop`은 non-throw.)
  - SSOT: `docs/30_SPEC/app.spec.md`

---

## 1. 이 파일의 사용법

각 항목은 아래 형식으로 작성한다.

- **문제(Problem)**: 현재 미정의/모순/비판정형인 지점
- **왜 문제인가(Why it matters)**: 무엇이 깨지는가(결정성 / 빌드타임 판정 가능성 / 런타임 의미론)
- **필요 결정(Decision required)**: 격차를 닫기 위한 최소 결정
- **SSOT 반영 대상(SSOT patch target)**: 수정되어야 할 `docs/**` 파일
- **검증 기준(Acceptance criteria)**: boolean, machine-checkable 조건

---

## 2. Manifest handoff가 닫혀있지 않음 (blocking)

- 문제
  - 여러 L3 SPEC이 산출물 스키마/저장 위치를 `docs/30_SPEC/manifest.spec.md`로 handoff하지만, 현재 `BunnerManifest`는 `config`와 `modules`만 표현한다.
  - 예시:
    - DI wiring 형식은 `manifest.spec.md`로 handoff됨 (`docs/30_SPEC/di.spec.md`).
    - Adapter Static Spec 직렬화/저장 위치는 `manifest.spec.md`로 handoff됨 (`docs/30_SPEC/adapter.spec.md`).
- 왜 문제인가
  - 구현이 기계적으로 검증 불가: SPEC이 요구하는 데이터를 어디에 어떤 스키마로 기록해야 하는지 SSOT가 없어서, 구현이 해석/임의 산출물에 의존하게 된다.
- 필요 결정
  - 아래 중 정확히 1개를 선택해 SSOT로 고정한다.
    1. `BunnerManifest`를 확장해 해당 산출물을 포함하고, 모든 handoff가 구체 필드로 연결되도록 수정한다.
    2. Manifest 외 별도 산출물을 정의(새 spec + 저장 위치)하고, handoff를 그 산출물로 이동시킨다.
- SSOT 반영 대상
  - `docs/30_SPEC/manifest.spec.md` (옵션 2면 추가 `*.spec.md` 포함)
  - `di.spec.md`, `adapter.spec.md` 등 handoff 문구를 가진 모든 문서
- 검증 기준
  - “Handoff → manifest.spec.md” 문구마다, SSOT에 검증 가능한 구체 필드/스키마/저장 위치가 존재한다.
  - “필요 산출물”이 정의된 스키마 없이 요구되지 않는다.

---

## 3. `AdapterId` 구분자 충돌로 인한 비판정성 (blocking)

- 문제
  - `AdapterId`가 제약 없는 `string`으로만 정의됨 (`docs/30_SPEC/common.spec.md`).
  - 그런데 다른 계약은 구분자 기반으로 파싱 가능한 ID를 요구한다.
    - `MiddlewareLifecycleId`: `"<AdapterId>:<PhaseId>"` (`docs/30_SPEC/module-system.spec.md`)
    - `HandlerId`: `"<adapterId>:<file>#<symbol>"` (`docs/30_SPEC/diagnostics.spec.md`)
  - `AdapterId`에 구분자 문자가 포함될 수 있으면, 위 형식은 기계적으로 역파싱 불가능(비판정형)해진다.
- 왜 문제인가
  - ID 정규화/파싱이 불가능해져 결정성 및 진단/DevTools 산출물 정합성이 붕괴한다.
- 필요 결정
  - `AdapterId`에 대한 단일 규칙을 SSOT로 고정한다.
  - 최소 폐쇄: `AdapterId`에서 `:` 및 `#`를 금지하거나, escape 규칙을 정의하고 모든 관련 스펙에 강제한다.
- SSOT 반영 대상
  - `docs/30_SPEC/common.spec.md` (AdapterId 제약)
  - `module-system.spec.md`, `diagnostics.spec.md`, `devtools.spec.md`
- 검증 기준
  - `HandlerIdFormatRules`와 `MiddlewareLifecycleId` 파싱이 휴리스틱 없이 구현 가능하다.
  - 유효하지 않은 `AdapterId`에 대한 Build-Time Violation이 정의되어 있다.

---

## 4. Result Error 마커 책임과 “자동 주입 금지”의 충돌 가능성 (blocking)

- 문제
  - `Result<T, E>`는 Error 값에 `BunnerErrorMarker`(`__bunner_error__ = true`) 포함을 요구한다.
  - 동시에 같은 문서는 “프레임워크가 `E`에 최소 필드를 자동 주입해서는 안 된다”고 말한다.
  - `error-handling.spec.md`는 Panic(throw)을 Exception Filter Chain을 통해 Result(Error 케이스)로 변환해야 한다고 요구한다.
  - throw→Result 변환 경로에서 “마커를 누가 보장하는가”가 계약으로 닫혀있지 않다.
- 왜 문제인가
  - 구현체가 제각각(마커 주입/미주입/에러 래핑/형상 변경)으로 갈라져 SSOT 준수 판정이 불가능해진다.
- 필요 결정
  - 아래 중 정확히 1개를 SSOT로 고정한다.
    - (A) Exception Filter는 항상 마커가 포함된 Error 값을 반환해야 하며, 프레임워크는 주입하지 않는다.
    - (B) 프레임워크는 필터가 만든 Error를 래핑/마킹할 수 있으며, “자동 주입 금지”는 도메인 Error(사용자 생성)로 범위를 좁힌다.
    - (C) 마커 기반 판정을 폐기하고, 다른 판정형 규칙으로 Result 구분을 정의한다.
- SSOT 반영 대상
  - `docs/30_SPEC/common.spec.md`
  - `docs/30_SPEC/error-handling.spec.md`
- 검증 기준
  - 필터 체인을 거친 throw는 항상 `Result<T, E>`의 Error 케이스 형상에 부합하며, 동시에 “자동 주입 금지” 규칙을 위반하지 않는다.

---

## 5. Controller/Handler 인스턴스 생성 및 DI 소유권 모델 부재 (blocking)

- 문제
  - `Handler`는 Controller class의 method로 정의되고, `HandlerId`는 `<controllerClassName>.<handlerMethodName>`을 요구한다.
  - `adapter.spec.md`는 `pipeline.handler`가 dispatcher `FactoryRef`여야 하며 빌드 타임에 판정된 Handler를 호출할 수 있어야 한다고 요구한다.
  - 그런데 Controller 인스턴스를 누가/어떻게 생성/소유하는지(DI provider인지, 별도 런타임 오브젝트인지, 스코프가 무엇인지), 그리고 dispatcher가 런타임 컨테이너 조회 없이 그 인스턴스를 얻는 규칙이 SSOT로 정의돼 있지 않다.
- 왜 문제인가
  - 인스턴스 모델이 없으면 dispatcher는 “결정성”과 “런타임 DI resolve 금지”를 동시에 만족하도록 구현될 수 없다.
- 필요 결정
  - Controller 소유권 모델을 SSOT로 고정한다.
    - Controller는 `@Injectable()` Provider인가? (토큰/스코프/visibleTo 규칙이 적용되는가)
    - 아니라면, 별도의 Controller 인스턴스화 계약(요청 단위 동작 포함)을 판정형으로 정의한다.
- SSOT 반영 대상
  - 신규 L3 spec 추가 또는 기존 spec 확장: `adapter.spec.md`, `di.spec.md`, `provider.spec.md` (필요 범위에 따라)
  - SSOT 문서에 새 용어/백틱 토큰이 추가되면 DW-TERM 규칙에 따라 `docs/10_FOUNDATION/GLOSSARY.md` 갱신
- 검증 기준
  - dispatcher는 “빌드 타임 wiring + 런타임 입력”만으로 handler method를 호출할 수 있다(동적 resolve 없음).
  - Controller 수명주기 및 요청 스코프 규칙이 판정형이며 테스트 가능하다.

---

## 6. Middleware lifecycle 전역 순서 규칙 부재 (major)

- 문제
  - lifecycle id 내부에서는 선언 순서 보존이 보장되지만, 서로 다른 lifecycle id/phase 간 순서가 정의돼 있지 않다.
- 왜 문제인가
  - `pipeline.middlewares`가 결정적이어야 하는데, 전역 순서가 없으면 동일 입력에서도 실행 순서가 달라질 수 있다.
- 필요 결정
  - lifecycle id의 전역 순서 규칙을 1개로 고정한다.
    - 예: 어댑터가 “정렬된 phase 리스트”를 제공하고, registry 키는 그 순서로 배치하며, 동률/미정 phase는 금지(빌드 실패) 등.
- SSOT 반영 대상
  - `docs/30_SPEC/adapter.spec.md` (필요 시 참조 shape 포함)
  - `docs/30_SPEC/module-system.spec.md` (정규화/제약 변경이 필요하면)
- 검증 기준
  - 동일 registry 입력에서 `pipeline.middlewares` 순서는 유일하게 결정된다.

---

## 7. 멀티 모듈 환경에서 `AdapterConfig` 중복 선언 처리 규칙 부재 (major)

- 문제
  - `module-system.spec.md`는 모듈 루트 파일 내부의 `AdapterConfig`를 정의하지만, 동일 `adapterId`가 여러 모듈에서 설정될 때의 동작을 정의하지 않는다.
- 왜 문제인가
  - 조용한 override/merge는 묵시적 동작을 만들고, 결정성과 안전성이 깨진다.
- 필요 결정
  - 아래 중 1개를 판정형 규칙으로 고정한다.
    - (A) 모듈 간 중복 선언을 금지(빌드 실패)
    - (B) 허용하되 고정 우선순위 규칙 + 필드별 merge 규칙을 정의
    - (C) 선언된 owner 모듈에서만 허용
- SSOT 반영 대상
  - `docs/30_SPEC/module-system.spec.md`
  - `docs/30_SPEC/diagnostics.spec.md` (해당 위반에 대한 진단이 정의돼야 함)
- 검증 기준
  - 중복 `adapterId` 설정의 결과는 결정적이거나, 반드시 진단을 동반한 빌드 실패다.

---

## 8. Diagnostics severity 정렬 순서 미정의 (minor)

- 문제
  - 진단은 `severity` 기준 결정적 정렬을 요구하지만, severity의 순서가 정의돼 있지 않다.
- 필요 결정
  - severity의 명시적 순서(예: `error < warning < info`)와 정렬 방식(enum 기반인지/사전순인지)를 고정한다.
- SSOT 반영 대상
  - `docs/30_SPEC/diagnostics.spec.md`
- 검증 기준
  - 해석 없이 comparator를 구현할 수 있다.

---

## 9. ID에 사용되는 경로 정규화 알고리즘 SSOT 부재 (minor)

- 문제
  - 여러 스펙이 “프로젝트 루트 기준 정규화된 상대 경로”(ModuleId, Location.file, HandlerId의 `<file>` 등)에 의존하지만, 정규화 알고리즘이 단일 SSOT로 정의돼 있지 않다.
- 필요 결정
  - 결정적 ID 생성을 위해 충분한 단일 정규화 알고리즘을 정의한다(점 세그먼트 처리, 구분자, macOS 대소문자, symlink 처리 등).
- SSOT 반영 대상
  - Identity에 직접 영향이 있으므로 L1/L2에 두는 것이 우선: `docs/10_FOUNDATION/INVARIANTS.md` 또는 `docs/20_ARCHITECTURE/ARCHITECTURE.md` (또는 전용 SSOT 문서) + L3에서 참조
- 검증 기준
  - 동일한 파일 시스템 입력에서, 경로를 포함하는 모든 ID가 안정적이며 비교 가능하다.

---

## 10. “AOT-serializable” 판정 규칙 부재 (major)

- 문제
  - `module-system.spec.md`는 `MiddlewareRegistrationInput`에서 다음을 허용한다:
    - `{ token: <Identifier>, options?: <Any AOT-Serializable Expression> }`
    - “Call/new expressions that are AOT-serializable”
  - 그러나 “AOT-serializable”의 판정 규칙(허용 AST 형태/금지 형태/정규화/결정성 입력 포함 범위)이 SSOT로 정의돼 있지 않다.
- 왜 문제인가
  - 동일 입력에서 `options`의 의미가 구현체마다 달라질 수 있어, 빌드 타임 판정 및 결정성 계약을 만족하는 구현을 기계적으로 검증할 수 없다.
- 필요 결정
  - “AOT-serializable”을 단일 판정 규칙으로 고정한다.
    - 최소 폐쇄: 허용 AST 형태를 열거하고(예: 리터럴/배열/오브젝트 리터럴 등), 호출/생성 표현식 허용 여부 및 허용 시 조건(순수성/외부 캡처 금지/결정성 입력 한정)을 판정형으로 정의한다.
- SSOT 반영 대상
  - `docs/30_SPEC/module-system.spec.md`
  - (정의 소유를 분리할 경우) `docs/30_SPEC/aot-ast.spec.md` 또는 신규 `*.spec.md` + `module-system.spec.md`에서 참조
- 검증 기준
  - “AOT-serializable”을 구현하기 위한 validator가 휴리스틱 없이 구현 가능하다.
  - 불허 형태가 입력됐을 때 Build-Time Violation이 정의돼 있고 diagnostics 형식으로 관측 가능하다.

---

## 11. “표준 오류 페이로드” SSOT 정의 부재 (major)

- 문제
  - `docs.spec.md`는 API 명세 생성 입력으로 “표준 오류 페이로드”를 요구한다.
  - 그러나 L3(`common.spec.md`, `error-handling.spec.md` 포함) 어디에도 “표준 오류 페이로드”의 정의/형상/출처가 닫혀 있지 않다.
- 왜 문제인가
  - 문서 생성은 “필수 입력이 누락되면 빌드 실패”를 위반 조건으로 요구하는데, 무엇을 생성/검증해야 하는지 SSOT가 없어 구현이 임의 해석에 의존한다.
- 필요 결정
  - “표준 오류 페이로드”의 단일 정의(형상, 어떤 실패에서 포함되는지, source of truth)를 SSOT로 고정한다.
  - docs.spec.md에서 참조하는 용어가 실제로 존재하는 정본 정의로 연결되도록 handoff를 닫는다.
- SSOT 반영 대상
  - `docs/30_SPEC/docs.spec.md`
  - `docs/30_SPEC/common.spec.md` 및/또는 `docs/30_SPEC/error-handling.spec.md` (정의 소유 위치에 따라)
  - DW-TERM 규칙에 따라 필요 시 `docs/10_FOUNDATION/GLOSSARY.md`
- 검증 기준
  - “표준 오류 페이로드”가 단일 스키마로 정의돼 있으며, docs generator가 이를 입력으로 삼는 것을 기계적으로 검증 가능하다.

---

## 12. MCP Server “명령/도구 표면” 계약 미폐쇄 (blocking)

- 문제
  - `mcp-server.spec.md`는 “서버가 제공하는 명령/도구 표면이 명시되지 않았는데도 서버가 시작/등록에 성공하면 위반”을 정의한다.
  - 동시에 본 SPEC은 추가적인 Static Shape/Observable Semantics를 정의하지 않으므로, “명시해야 하는 표면”이 SSOT로 닫히지 않는다.
- 왜 문제인가
  - 구현이 어떤 명령/도구를 제공해야 하는지, 또는 제공 중인 표면이 완전한지의 판정 기준이 없어 빌드/테스트 위반을 기계적으로 검증할 수 없다.
- 필요 결정
  - MCP Server가 제공하는 명령/도구 표면을 판정형(명령 이름, 입력/출력 최소 형상, 결정성/부작용 제약)으로 고정한다.
- SSOT 반영 대상
  - `docs/30_SPEC/mcp-server.spec.md`
  - 필요 시 `docs/30_SPEC/diagnostics.spec.md` (명령 실패 시 진단 형식이 요구되면)
- 검증 기준
  - 명령/도구 표면이 명시된 리스트(또는 스키마)로 존재하며, 누락/추가가 테스트 레벨에서 기계적으로 검출 가능하다.

---

## 13. DTO “스키마로 판정 가능”의 판정 기준 부재 (major)

- 문제
  - `dto.spec.md`는 DTO가 “스키마로 정의 가능”해야 하고, “스키마로 판정 가능하지 않은데도 빌드가 성공하면 위반”을 요구한다.
  - 그러나 본 SPEC은 추가 Static Shape를 정의하지 않아, “스키마로 판정 가능”의 구체 판정 규칙(허용 선언/데코레이터/중첩/배열/옵셔널 등)이 닫혀 있지 않다.
- 왜 문제인가
  - DTO 스키마 판정의 합/불합이 구현체마다 갈라질 수 있어, 빌드 실패 조건을 기계적으로 재현/검증할 수 없다.
- 필요 결정
  - DTO 스키마 판정 규칙을 단일 SSOT로 고정한다.
    - 최소 폐쇄: “스키마로 판정 가능한 DTO”의 허용 형태를 열거하고, 금지 형태 및 위반 시 진단을 정의한다.
- SSOT 반영 대상
  - `docs/30_SPEC/dto.spec.md`
  - `docs/30_SPEC/docs.spec.md` (DTO 스키마를 입력으로 요구하므로 연결 필요)
  - 필요 시 `docs/30_SPEC/diagnostics.spec.md`
- 검증 기준
  - DTO 입력에 대해 스키마 판정이 항상 결정적이며, 판정 불가/금지 형태는 Build-Time Violation으로 관측된다.

---

## 14. 용어(GLOSSARY) 중복/미사용/누락 정합성 미폐쇄 (major)

- 문제
  - `docs/50_GOVERNANCE/DOCS_WRITING.md`의 DW-TERM 규칙은 “규범 키워드가 포함된 라인에 새 백틱 토큰이 추가되면, GLOSSARY 또는 해당 문서의 Definitions에 정의돼 있어야 함”과 “Term 중복 정의 금지/파일-로컬 정의의 범위 제한”을 강제한다.
  - 현재 L3 문서들에는 "Definitions"에서 Term을 정의하지만(`- <Term>:`), 해당 Term이 다른 문서에도 등장하거나(=file-local이 아님) GLOSSARY에 존재하지 않아 DW-TERM-003 위반 가능성이 열려 있다.
  - 또한 GLOSSARY에 존재하지만 L3 스펙군에서 동일 Term 문자열로는 거의/전혀 사용되지 않는 항목이 있어(미사용), 용어 SSOT로서의 정합성이 닫히지 않는다.

  - (확정된 DW-TERM-003 위반)
    - `MCP Server`
      - 정의: `docs/30_SPEC/mcp-server.spec.md`의 `### 1.3 Definitions`
      - 동일 파일 밖 등장: `docs/30_SPEC/devtools.spec.md`의 `### 1.2 Scope & Boundary`
      - GLOSSARY 미정의: `docs/10_FOUNDATION/GLOSSARY.md`
    - `Error`, `Panic(System Error)`
      - 정의: `docs/30_SPEC/error-handling.spec.md`의 `### 1.3 Definitions`
      - 동일 파일 밖 등장: `docs/30_SPEC/logger.spec.md`의 `### 3.1 MUST`
      - GLOSSARY 미정의: `docs/10_FOUNDATION/GLOSSARY.md`
    - `Wiring`
      - 정의: `docs/30_SPEC/di.spec.md`의 `### 1.3 Definitions`
      - 동일 파일 밖 등장: `docs/30_SPEC/adapter.spec.md`의 `### 3.1 MUST`
      - GLOSSARY 미정의: `docs/10_FOUNDATION/GLOSSARY.md`

  - (용어 드리프트 리스크: DW-TERM 위반은 아님)
    - `docs/10_FOUNDATION/GLOSSARY.md`에는 `DI Cycle`이 정의되어 있으나, `docs/30_SPEC/di.spec.md`는 `Dependency Cycle`을 별도 Term으로 정의한다.

  - (누락 가능성이 높은 Definitions 정의 예시)
    - `docs/30_SPEC/provider.spec.md`: `Provider`, `Scope`, `Resource Provider`
    - `docs/30_SPEC/di.spec.md`: `Wiring`, `Dependency Cycle`
    - `docs/30_SPEC/error-handling.spec.md`: `Error`, `Panic(System Error)`
    - `docs/30_SPEC/adapter.spec.md`: `Middleware Lifecycle`, `Middleware Phase`, `Adapter Owner Decorator`, `Adapter Member Decorator`
    - `docs/30_SPEC/dto.spec.md`: `DTO Transformer`, `DTO Validator`
    - `docs/30_SPEC/docs.spec.md`: `OpenAPI/AsyncAPI Artifact`, `Consistency`
    - `docs/30_SPEC/logger.spec.md`: `Structured Log`, `Correlation`
    - `docs/30_SPEC/ffi.spec.md`: `FFI Boundary`, `Safety`
    - `docs/30_SPEC/drizzle-orm.spec.md`: `ORM Integration`
    - `docs/30_SPEC/devtools.spec.md`: `Non-intrusive`
    - `docs/30_SPEC/mcp-server.spec.md`: `MCP Server`

  - (미사용/불일치 가능성이 있는 GLOSSARY 항목 예시)
    - `Context Pollution`, `Repository Hygiene`, `Persona` 등은 L3 계약(spec)에서 직접 사용되는 범위가 불명확하다.
    - GLOSSARY의 `DI Cycle`과 L3의 `Dependency Cycle`처럼, 동일 개념의 명명 규칙이 분산될 수 있다.

- 왜 문제인가
  - Term SSOT가 닫히지 않으면, 문서 변경 시 DW-TERM 집행이 “추측/사람 판단”에 의존하게 되고, 용어 중복/드리프트가 누적된다.
  - 계약 문서(L3)가 동일 개념을 서로 다른 문자열로 부르면, 구현/진단/테스트 문구가 분기되어 기계적 검증 가능성이 떨어진다.

- 필요 결정
  - (A) L3 스펙군에서 2개 이상 파일에 등장하는 Term은 모두 GLOSSARY로 승격하고, 각 spec의 Definitions에서는 중복 정의를 제거한다.
  - (B) “file-local Definitions”를 허용할 Term의 기준을 판정형으로 고정한다(동일 파일 외 등장 금지 또는 등장 시 GLOSSARY 승격).
  - (C) 동일 개념에 대해 단일 표기(정본 Term 문자열)를 선택하고, 모든 L3에서 그 표기만 사용하도록 정렬한다.

- SSOT 반영 대상
  - `docs/10_FOUNDATION/GLOSSARY.md`
  - Definitions를 가진 각 L3 문서: `docs/30_SPEC/{adapter,di,provider,error-handling,dto,docs,logger,ffi,drizzle-orm,devtools,mcp-server}.spec.md`
  - (필요 시) `docs/50_GOVERNANCE/DOCS_WRITING.md`의 DW-TERM 규칙을 변경하지 않고도 통과 가능하도록 문서 정렬

- 검증 기준
  - DW-TERM-002 위반(동일 Term의 2개 이상 파일 정의)이 존재하지 않는다.
  - DW-TERM-003 위반(파일-로컬 Definitions Term이 다른 파일에 등장하지만 GLOSSARY 미정의)이 존재하지 않는다.
  - GLOSSARY Term은 L3 스펙군에서 실제로 사용되거나, 사용 범위가 L1/L2/거버넌스 등으로 명확히 정당화되어 있다.

---

## 15. 문서 간 명명/표기/위임 드리프트(불일치) 전수 목록 (major)

- 문제
  - 동일 개념/계약이 문서 간 서로 다른 이름/표기/위임으로 기술되어, 구현이 “어느 문장을 정본으로 따라야 하는지” 판정 불가능한 지점이 남아 있다.
  - (P0 / 계약 충돌급)
    - `docs/30_SPEC/common.spec.md` Result 마커 토큰 불일치
      - `BunnerErrorMarkerKey`의 const: `"**bunner_error**"`
      - `BunnerErrorMarker`의 required property: `__bunner_error__`
      - 동일 축(에러 마커)에서 키/형상이 달라 구현이 분기된다.
  - (P1 / handoff 미수신)
    - `docs/30_SPEC/adapter.spec.md` → `manifest.spec.md`로 “Adapter Static Shape 직렬화/저장 위치” handoff하나, `manifest.spec.md`에 수신 필드/섹션이 없다.
    - `docs/30_SPEC/docs.spec.md`가 “manifest.spec.md의 산출물 섹션”을 참조하나, `manifest.spec.md`에 해당 섹션이 없다.
    - `docs/30_SPEC/provider.spec.md`가 “scope의 프로세스 경계 해석”을 `cluster.spec.md`로 이관하나, `cluster.spec.md`에 구체 규칙이 없다.
  - (P2 / 용어·식별자 표기 드리프트)
    - `docs/30_SPEC/module-system.spec.md`의 `MiddlewareLifecycleId` 규칙에서 `<PhaseId>`를 사용하나, L1 `GLOSSARY.md`에는 `PhaseId` 용어가 없다(대신 `Middleware Phase`만 존재).
    - 여러 SPEC에서 “Structural Context / Structural Context Propagation”을 사용하나, L1 `GLOSSARY.md`에는 해당 용어 항목이 없다(현재는 서술 용어로만 존재).
  - (P3 / 표기(케이싱) 및 필드명 드리프트)
    - `docs/30_SPEC/diagnostics.spec.md`의 `HandlerIdFormat` placeholder가 `adapterId`로 표기되지만, 타입/용어는 `AdapterId`로 서술된다.
    - `docs/30_SPEC/aot-ast.spec.md`의 `BunnerConfigSource.(path, format)`과 `docs/30_SPEC/manifest.spec.md`의 `ManifestConfig.(sourcePath, sourceFormat)`이 같은 축을 가리키지만 필드명이 다르다.
  - (P3 / 용어 재사용으로 인한 오해 리스크)
    - L1 `INVARIANTS.md`의 “Alias(별칭) 없음(경로 동일성)”과 L3 `common.spec.md`의 `useExisting` 설명의 “별칭(alias)”이 서로 다른 의미로 재사용되어 오해 위험이 있다.

- 왜 문제인가
  - 동일 구현이 문서 해석에 따라 서로 다른 산출물/정렬/키를 만들 수 있어, L3의 “기계적 검증 가능성” 목표가 붕괴한다.

- 필요 결정
  - (A) P0 항목은 단일 정본(키/형상)을 선택해 `common.spec.md`에서 모순 없이 닫는다.
  - (B) P1 항목은 handoff 문구를 “실제로 존재하는 수신 스키마/섹션”으로 연결하거나, 수신 문서를 확장해 수신되도록 닫는다.
  - (C) P2/P3 항목은 “정본 용어/정본 필드명/정본 표기”를 1개로 고정하고 전 문서에서 정렬한다.

- SSOT 반영 대상
  - P0: `docs/30_SPEC/common.spec.md`
  - P1: `docs/30_SPEC/manifest.spec.md`, `docs/30_SPEC/adapter.spec.md`, `docs/30_SPEC/docs.spec.md`, `docs/30_SPEC/provider.spec.md`, `docs/30_SPEC/cluster.spec.md`
  - P2/P3: `docs/10_FOUNDATION/GLOSSARY.md` + 관련 L3 문서들

- 검증 기준
  - P0: Result Error 케이스 마커의 “키/형상”이 단일 규칙으로 정의되어 있고, 테스트에서 1가지 형태만 허용된다.
  - P1: 모든 handoff 문장이 “수신 문서의 실제 필드/섹션”에 1:1로 대응된다.
  - P2/P3: 동일 개념/입력에 대해 문서 간 표기/이름이 분기되지 않는다.
