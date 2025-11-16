# 실행 계획 (PLAN)

> 목적: `REPORT.md`에 기록된 모든 문제와 개선안을 실제 코드/문서/운영 절차에 반영하기 위한 단계별 실행 계획. 전 구간에서 **Bun 런타임 + build 시점 이후 완전 불변(immutable) 라우터** 원칙을 유지한다.

## 1. 빌드-불변 토대 구축 (섹션 3.8, 3.9)

### 1.1 RouterBuilder / RouterInstance 이원화 (3.9.1)

1. `packages/core/src/bunner.ts`와 `router` 관련 엔트리에서 현재 Router 클래스를 분리하여 `RouterBuilder` (mutable) + `RouterInstance` (readonly) 생성.
2. `add`/`addAll`/검증 로직은 Builder에만 남기고, `build()` 호출 시 정적 스냅샷을 생성하여 Instance에 주입.
3. Builder 해제 후에는 참조가 남지 않도록 타입/런타임 가드 추가.

#### 진행 현황 (2025-11-16)

- [x] `packages/http-server/src/router/router.ts`를 Builder/Instance 구조로 재작성하고 불변 스냅샷을 생성.
- [x] Builder 전용 `add`/`addAll` 경로와 `build()` 완료 후 가드를 적용.
- [x] 통합 테스트(`packages/http-server/tests/integration/router/**/*.test.ts`)를 Builder/Instance 흐름으로 갱신.

### 1.2 빌드 시 일괄 최적화 파이프라인 (3.9.2)

1. Builder `build()` 과정에 다음 스테이지를 순차 실행: 정적 압축, 파라미터 재정렬, 와일드카드 suffix 사전 계산, 정규식 안전성 검사.
2. 각 스테이지 실패 시 전체 빌드를 중단하고 사용자에게 명확한 에러 반환.
3. 빌드 로그에 각 스테이지 결과/소요 시간 기록(추후 관측성 훅과 연동).
4. 기존 런타임 지연 실행 훅(`match` 내 `compressStaticSubtree` 등)은 제거/비활성화.

#### 진행 현황 (2025-11-16)

- [x] `build()` 파이프라인에 정적 압축/파라미터 재정렬/동적 플래그 재계산 스테이지와 실패 시 예외 처리를 추가.
- [x] 각 스테이지 실행 시간을 로그로 남기기 시작.
- [x] 와일드카드 suffix 사전 계산 및 정규식 안전성 검사 스테이지 구현.
- [x] 런타임 지연 압축 훅 완전 제거 및 벤치마크 회귀 검증 (2025-11-16).
  - `ensureCompressed`/`requestCompression` 제거 후 `build()` 단계에서만 `compressStaticSubtree`를 실행하도록 고정.
  - `packages/http-server/bench/router/runner.ts`가 스테이지 로그를 필터링한 순수 JSON을 저장하도록 보완하고, 최신 벤치(`router-bench-2025-11-16T12-27-06-205Z.json`)에서 성능 회귀 없음 확인.

### 1.3 불변 데이터 레이아웃 (3.9.3)

1. 빌드 결과를 `Map`/`Set`에서 배열+오프셋 구조로 직렬화하는 프로토타입 작성.
2. 런타임 경로 탐색기는 새 레이아웃을 순회하도록 리팩터링하고, 개발 모드에서는 `Object.freeze`로 보호.
3. GC/성능 영향을 벤치마크(`packages/http-server/bench/router`)로 검증.

### 1.4 동적 라우트 플래그 재계산 (3.8.1)

1. Builder가 전체 트리를 스캔하여 `hasDynamicRoutes`, `hasWildcardRoutes` 등 플래그를 계산하고 Instance에 읽기 전용으로 주입.
2. 기존 런타임 중 단방향 플래그 갱신 로직 제거.
3. 스냅샷 메타데이터(`packages/core/src/common/constants.ts` 등)에 플래그를 저장하여 디버깅 시 확인 가능하게 함.

#### 진행 현황 (2025-11-16)

- [x] 빌드 파이프라인에서 전체 노드를 스캔하여 `hasDynamicRoutes`/`hasWildcardRoutes`를 재계산.
- [x] 런타임 플래그 갱신 코드 완전 제거 및 스냅샷 메타데이터 노출.

## 2. 캐시/성능 개선 (섹션 2.1, 2.4, 3.1, 3.4)

### 2.1 버전 기반 캐시 무효화 (3.1.1)

1. 라우터 전역 `cacheVersion` 카운터 도입, Builder 변경 시 증가.
2. 캐시 항목 구조에 `version` 추가, 조회 시 mismatch면 stale 처리.
3. 기존 `invalidateCacheForRoute`/`applyCacheInvalidation`는 최소화하거나 버전 증가 트리거로 단순화.
4. 회귀 테스트: 캐시 히트율, 무효화 정확성 시나리오 추가.

### 2.2 LRU 정확성 확보 (3.1.2)

1. 조회 시에도 `delete`+`set` 수행 또는 `lru-cache` 도입해 최근 사용 항목이 유지되도록 수정.
2. 캐시 크기 제한/슬로우 경로 테스트 추가.

### 2.3 캐시 키 포맷 강화 (3.1.3)

1. `${method}\0${normalizedPath}` 형태 키 도입, 키 생성/조회 지점 업데이트.
2. 기존 캐시 flush 후 새 포맷만 사용하도록 마이그레이션 코드 작성.

### 2.4 CacheIndex 누수 수정 (3.1.4)

1. `packages/http-server/src/router/cache-index.ts`의 `removeRecursive`에서 빈 노드 제거 플래그를 부모가 활용하도록 fix.
2. Memory leak 재현 테스트 및 장기 실행 벤치 추가.

### 2.5 정적 패스트 정규화 (3.4.1)

1. `tryStaticFastMatch`에 연속 슬래시, `.`/`..` 정규화를 추가하되 비용 측정.
2. `blockTraversal` 옵션과 상호작용 검증.

### 2.6 대소문자 처리 최적화 (3.4.2)

1. 정적 캐시에 원본/소문자 key를 함께 보관해 불필요한 `toLowerCase()` 호출을 제거.
2. 벤치마크로 효과 검증, 영향이 미미하면 옵션화.

### 2.7 파라미터 우선순위 고도화 (3.4.3)

1. 정렬 주기를 임계값+확률 혼합 방식으로 변경.
2. 히트 카운트를 메모리에 보존하거나 스냅샷에 직렬화하여 재시작 후 로드.
3. 재시작 전후 성능 비교 테스트 작성.

### 2.8 와일드카드 suffix 사전 계산 (3.4.4)

1. `DynamicMatcher` 생성 시 suffix 값을 미리 주입하고 런타임 계산 제거.
2. `config.suffixSource` 사용 지점을 검토해 중복 제거.

### 2.9 SIMD/비트셋 정적 경로 최적화 (3.11.2)

1. 빌드 단계에서 정적 경로를 길이별 배열/비트셋으로 분류.
2. 런타임 정적 매칭 루틴을 SIMD friendly 비교로 교체(Bun/V8 실험 필요).
3. 벤치 스위트(`bench/router`)로 이득 검증, 옵션화 후 기본값 결정.

## 3. 보안 및 정규식 대응 (섹션 2.2, 2.3, 3.2, 3.3)

### 3.1 '%2F' 디코딩 정책 옵션화 (3.2.1)

1. `decodeParams`/`decodeURIComponentSafe`에 `preserveEncodedSlashes`/`strict` 옵션 추가.
2. 기본값/호환성 정책을 문서화하고, 서명된 URL 테스트 작성.

### 3.2 경로 순회 방어 강화 (3.2.2)

1. 디코딩 전 `%2e` 패턴 필터링 또는 디코딩 후 dot 세그먼트 재검사 로직 추가.
2. `blockTraversal` 옵션의 테스트 케이스를 퍼센트 인코딩 버전까지 확장.

### 3.3 정규식 타임아웃 처리 일관화 (3.3.1)

1. `regexSafety.mode = 'warn'`일 때 예외 대신 브랜치 실패 + 경고 로그로 처리.
2. `pattern-tester.ts`에서 onTimeout 콜백이 동작 모드별로 분기하도록 수정, 단위 테스트 추가.

### 3.4 정규식 안전성 검사 강화 (3.3.2)

1. `safe-regex2` 또는 `recheck` 라이브러리를 의존성에 추가하고 휴리스틱을 확장.
2. 위험 패턴 샘플 세트를 추가하여 false positive/negative 회귀 테스트.

### 3.5 정규식 앵커링 정책 명확화 (3.3.3)

1. 파라미터 정규식을 파싱할 때 사용자 앵커를 감지하면 제거하거나 경고를 출력.
2. 문서(`README.md`, `examples/README.md`)에 새 정책과 예시 추가.

## 4. API/기능 및 관측성 (섹션 2.6, 2.7, 3.6, 3.7, 3.10.3)

### 4.1 불변 스냅샷 배포 가이드 (3.6.1)

1. `README.md`/`REPORT.md`에 빌드 전용 스냅샷 정책과 운영 절차(rolling restart, snapshot 주입)를 명시.
2. CLI/스크립트(예: `packages/http-server/bin`)로 스냅샷 생성 및 배포 자동화 예시 제공.

### 4.2 HTTP 메서드 호환성 옵션 (3.6.2)

1. Router 설정에 `headFallbackToGet`, `autoOptions` 옵션 추가.
2. `OPTIONS` 응답 시 허용 메서드 집합을 계산하는 유틸 추가.
3. 통합 테스트로 호환성 검증.

### 4.3 ':name\*' 문법 지원 (3.6.3)

1. 파서(`packages/http-server/src/router/node.ts` 주변)와 매처에 `*` (0개 이상) 토큰 추가.
2. 기존 `:name+`/와일드카드와의 우선순위 규칙 정의 및 테스트.

### 4.4 관측성 훅 (3.6.4 & 3.10.3)

1. 라우터 옵션에 `onRouteMatch`, `onCacheHit/Miss`, `onStaticFastHit`, `onParamBranchTaken`, `onStageStart/End` 콜백 추가.
2. 최소한의 오버헤드로 계측 데이터를 수집하고, 샘플 adapter 제공(Prometheus/console).

### 4.5 검증/에러 처리 개선 (3.7)

1. 전역 중복 파라미터 검사를 옵션화(`strictParamNames`)하고 충돌 시 빌드 에러 발생.
2. 라우트 중복 에러 메시지에 메서드명 포함.
3. 옵셔널 파라미터 값 처리 모드(`omitOptionalParam`, `setUndefined`, `setEmptyString`)를 옵션으로 제공하고 문서화.

## 5. 아키텍처 & 유지보수 (섹션 2.5, 3.5)

### 5.1 match-walker 가독성 향상 (3.5.1)

1. `match-walker.ts`에 상태 다이어그램/주석 추가.
2. 스택 처리 단계를 private 메서드로 분리하고, FrameStage 별 Type 정리.
3. 디버깅 툴/로깅 훅(관측성)과 연계.

### 5.2 정적 압축 타이밍 개선 (3.5.2)

1. Builder 단계에서 압축을 강제 실행하도록 훅 추가(1.2와 연동).
2. 테스트에서 `add` 직후/빌드 직후 구조가 일치함을 검증.

### 5.3 메서드 인지 압축 전략 (3.5.3)

1. 압축 로직이 메서드별 서브트리를 고려하도록 리팩터링(필요 시 메서드별 노드를 분리).
2. 혼재된 메서드 시나리오 테스트 추가.

## 6. 파이프라인 엔진화 (섹션 3.10)

### 6.1 스테이지 선언/옵션 매핑 (3.10.1)

1. `Normalize → Decode → TraversalGuard → Compile → Suffix → Cache → Match` 스테이지 클래스를 정의하고 옵션 구조체 설계.
2. Builder/Instance 모두 동일 파이프라인 정의를 공유하도록 인터페이스화.

### 6.2 빌드/매칭/캐시 스테이지 토글 (3.10.2)

1. 파이프라인 정의에서 스테이지 활성 여부를 명시적으로 선언하고, 프로파일(보안 강화형, 성능 중시형 등) 프리셋 제공.
2. CI에서 각 프로파일 조합을 테스트해 회귀 방지.

### 6.3 관측/튜닝 훅 내장 (3.10.3)

1. 각 스테이지에 `onStageStart/onStageEnd` 호출 지점을 추가하고 지연/히트율을 수집.
2. 관측성 옵션(4.4)과 연결해 외부 메트릭 시스템에 전달.

---

이 계획의 각 체크박스가 완료되면 `REPORT.md`의 대응 항목을 "해결됨" 상태로 마킹할 수 있다. 단계별 실행 중 추가 이슈가 발견되면 `REPORT.md`에 추적 항목을 추가하고 PLAN에 후속 단계로 편입한다.
