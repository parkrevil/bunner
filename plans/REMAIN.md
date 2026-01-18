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
