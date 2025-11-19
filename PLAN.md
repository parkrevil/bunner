# 실행 계획 (PLAN)

> 목적: `REPORT.md`에 기록된 모든 문제와 개선안을 실제 코드/문서/운영 절차에 반영하기 위한 단계별 실행 계획. 전 구간에서 **Bun 런타임 + build 시점 이후 완전 불변(immutable) 라우터** 원칙을 유지한다.

---

## Router 파일 세분화 계획

**문제**: `packages/http-server/src/router/core/radix-router-core.ts`가 여전히 1,200+ 라인으로 옵션 정규화, 빌드 파이프라인, 매치 실행, 선택 파라미터 처리까지 한 파일에 몰려 있다.

**로드맵**

- [x] `core/router-options.ts`로 옵션 정규화/상수 분리 (`normalizeRegexSafety`, `normalizeParamOrderOptions`, `normalizePipelineStages`).
- [x] `core/router-cache.ts` 추상화로 캐시 키 생성·LRU 관리·스냅샷 적용을 캡슐화.
- [x] `core/static-fast-registry.ts`에서 정적 경로 등록/조회 전담.
- [x] `core/optional-param-defaults.ts`로 선택 파라미터 기본값 로직 분리 → 매치 단계에서 helper만 호출하도록 변경.
- [x] `core/match-runner.ts` (가칭)로 `performMatch`/`tryStaticFastMatch`/캐시 파이프라인을 별도 클래스로 분리.
- [x] `core/build-pipeline.ts` (가칭)로 현재 `runBuildPipeline`, `compressStaticSubtree`, `precomputeWildcardSuffixMetadata`, `recalculateRouteFlags`, `updateSnapshotMetadata`를 이관한다. 새 모듈은
  - `createBuildPipeline(options)` 팩토리에서 필요한 헬퍼를 주입받고,
  - `execute(root: RouterNode)` 한 함수로 모든 스테이지를 처리하며,
  - stage hook/observer 호출을 `RadixRouterCore`가 위임할 수 있도록 콜백을 노출한다.
    완료 후 core 파일에서는 빌더 상태 유지 + stage 콜백 정의로만 남게 된다.
    → `packages/http-server/src/router/core/build-pipeline.ts` 완성. `RadixRouterCore`는 새 헬퍼의 결과를 받아 메타데이터/플래그를 갱신하고, stage 에러 메시지도 동일하게 래핑한다.

각 단계 완료 시 파일 라인 수와 책임 범위를 기록하고, 마지막 단계에서 `RadixRouterCore`는 상태 보관 + orchestrator 역할만 수행하도록 한다.

### R2. DynamicMatcher 스테이지 모듈화

**문제**: `matcher/dynamic-matcher.ts`가 400+ 라인으로 프레임 스택, 정적/파라미터/와일드카드 처리, 디코딩 로직이 뒤섞여 있다.

**로드맵**

- [x] `matcher/match-frame.ts`로 스택 프레임 타입/상태 정의 분리.
- [x] `matcher/suffix-cache.ts`로 와일드카드 suffix 계산/캐시 로직 분리.
- [x] `matcher/stage-static.ts`/`matcher/stage-param.ts`/`matcher/stage-wildcard.ts` (가칭) 등 스테이지별 핸들러 모듈을 만들어 `DynamicMatcher` 본문은 루프+조립에 집중. 각 스테이지 모듈은 `(frame, ctx) => MatchOutcome` 형태로 순수 함수화한다.
      → 세 모듈을 추가해 정적/파라미터/와일드카드 처리를 함수 단위로 위임했다. `DynamicMatcher`는 이제 스택 루프와 스테이지 wiring만 담당한다.
- [x] `matcher/param-decoder.ts`로 `decodeURIComponentSafe` 래핑과 캐시를 분리해 테스트 용이성 확보. 새 모듈은 메모이제이션된 `getDecodedSegment(index)` 기능과 오류 처리를 캡슐화한다.
      → `ParamDecoder` 헬퍼가 디코딩 여부·캐시를 책임지고 스테이지 모듈에서 주입받도록 변경했다.

각 모듈화 단계 이후 `DynamicMatcher`의 공개 API가 변하지 않도록 회귀 테스트를 반드시 수행한다.

> 모든 세분화 작업은 기존 API/옵션 호환성을 유지하면서도 단일 책임 원칙을 만족하는 것을 목표로 한다.
