# 실행 계획 (PLAN)

> 목적: `REPORT.md`에 기록된 모든 문제와 개선안을 실제 코드/문서/운영 절차에 반영하기 위한 단계별 실행 계획. 전 구간에서 **Bun 런타임 + build 시점 이후 완전 불변(immutable) 라우터** 원칙을 유지한다.

---

## Router 파일 세분화 계획

    - **문제**: `packages/http-server/src/router/core/radix-router-core.ts`가 1,500+ 라인으로 옵션 정규화, 캐시, 빌드/매치 파이프라인을 모두 포함해 유지보수가 어렵다.
    - **계획**:
    	1. `core/router-options.ts`를 만들어 정규화 타입/상수와 관련 헬퍼(`normalizeRegexSafety`, `normalizeParamOrderOptions`, `normalizePipelineStages`)를 분리. ✅
    	2. `core/router-cache.ts`로 캐시 키 생성, LRU 조정, 스냅샷 적용 등을 캡슐화하고 `RadixRouterCore`는 캐시 전용 객체에 위임.
    	3. `core/static-fast-registry.ts`에서 정적 경로 정규화·등록·조회(케이스 보존 포함)를 담당하도록 분리.
    	4. 필요 시 `builder`/`pipeline` 별도 모듈로 남은 1,000라인을 단계적으로 축소.

### R2. DynamicMatcher 스테이지 모듈화

    - **문제**: `matcher/dynamic-matcher.ts`가 400라인을 넘으며 스택 프레임/와일드카드/디코딩 로직이 한 파일에 혼재.
    - **계획**:
    	1. `matcher/match-frame.ts`로 `FrameStage`, `MatchFrame` 타입과 스택 헬퍼를 이동. ✅
    	2. `matcher/suffix-cache.ts`로 와일드카드 suffix 계산과 캐시 관리를 분리. ✅
    	3. 본 파일은 `DynamicMatcher` 오케스트레이션과 고수준 흐름만 남겨 단일 책임을 강화.

위 작업을 순차적으로 적용해 각 파일이 명확한 책임과 적정 라인 수를 유지하도록 한다.
