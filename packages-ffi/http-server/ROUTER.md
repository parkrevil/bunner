# Bunner HTTP Router 설계와 알고리즘

## 목적과 목표

- 고성능 라우팅: Bun 런타임을 활용하여 정적/파라미터/정규식/와일드카드 경로를 빠르게 매칭
- 타입 안전성: Rust 기반으로 안전한 경계 내에서 최소한의 unsafe 사용
- 확장성: 대규모 라우트 테이블에서도 예측 가능한 지연시간과 낮은 메모리 오버헤드
- 명확한 수명주기: 삽입 → 압축 → 봉인(인덱스) → 조회

## 핵심 구성 요소

- RadixRouter: 트리 생명주기 전체를 오케스트레이션(삽입, 압축, 봉인, 인덱스 재빌드, 조회)
- RadixNode: 라우팅 노드. 정적/패턴 자식, 라우트 키, 접두사 압축 상태 보유
- NodeBox: NonNull<RadixNode> 래퍼. 아레나(bumpalo::Bump) 기반 노드 핸들
- Bump 아레나: 전체 라우터 수명 동안 유효한 할당자(할당 전용, 해제 비용 없음)
- Interner: 정적 문자열 키를 u32 ID로 인턴해 비교/탐색 비용 절감

## 데이터 구조 개요

- 정적 자식(Static)
  - 배열: `static_keys: SmallVec<[String; 16]>`, `static_vals: SmallVec<[NodeBox; 16]>`
  - 미러: `static_vals_idx: SmallVec<[NodeBox; 16]>`, `static_children_idx: HashMap<String, NodeBox>`
  - ID 미러: `static_key_ids: SmallVec<[u32; 16]>`, `static_children_idx_ids: HashMap<u32, NodeBox>`
- 패턴 자식(SoA: Struct of Arrays)
  - `patterns: SmallVec<[SegmentPattern; 4]>`, `pattern_nodes: SmallVec<[NodeBox; 4]>`
  - 뷰 인덱스: `pattern_children_idx: SmallVec<[usize; 8]>`
  - 인덱스: `pattern_first_literal: HashMap<String, SmallVec<usize>>`, `pattern_shape_index`, `pattern_shape_weak_index`
  - 점수: `pattern_scores: SmallVec<[usize; 16]>` (구체성 우선순위)
- 접두사 압축(Prefix Compression)
  - fused_edge: Option<String>, fused_child: Option<NodeBox>
- 라우트 키
  - `routes[Method]`, `wildcard_routes[Method]`
- 메타
  - sealed, dirty(증분 인덱스 재빌드 플래그)

## 수명주기

1. insert(삽입)

- 세그먼트를 파싱해 정적/파라미터/정규식/와일드카드를 구분
- 정적: descend_static_mut_with_alloc로 노드를 생성/이동
- 정렬 불변 유지: static_keys/static_vals를 interner ID 기준으로 정렬(이진 탐색 보장)
- 패턴: shape/weak-shape 인덱스로 후보를 좁힌 뒤, 호환성 검사 및 점수 기반 위치에 삽입
- 변경 노드는 dirty = true, 전역 미러는 invalidate_indices로 무효화

2. compress(압축)

- 조건: 자식 1개, 패턴 0개, 터미널 아님 → 단일 체인을 fused_edge로 병합해 경로 스킵 비용 감소

3. seal(봉인)

- 압축 수행 → 모든 노드 dirty = true → 정적 배열을 interner ID로 정렬 → build_indices → shrink_to_fit

4. build_indices(증분 인덱스 재빌드)

- 반복 DFS(Vec<\*mut RadixNode>)로 dirty 서브트리만 재구성
- static_vals_idx, static_children_idx(\_ids), pattern_children_idx를 재빌드
- rebuild_intern_ids(&Interner)로 정적 키 ID 캐시 갱신

## 조회 알고리즘(find)

1. 경로 정규화: 옵션에 따라 중복/후행 슬래시 정리, 대소문자 민감도 적용
2. 노드 루프

- 접두사 압축(fused_edge): (case-insensitive면 ASCII-ci 비교) 일치 시 위치를 한 번에 전진
- 정적 자식 우선 탐색 순서
  - interner ID 경로: interner.get(comp) → get_static_id_fast(id)로 이진 탐색
  - 문자열 키 경로: 정렬된 static_keys에서 하이브리드 탐색(≤8 선형, 초과시 이진)
  - 필요 시 맵/배열 참조로 보조
- 패턴 후보 생성: pattern_first_literal 인덱스가 있으면 우선 사용, 없으면 전체 인덱스
  - 후보 순서대로 match_segment 수행, 매칭되면 (name, (offset,len)) 형태로 zero-copy로 파라미터 수집
- 세그먼트 소진 시 현재 노드의 메서드 라우트 키 또는 와일드카드 키 반환

복잡도(경험적)

- 정적: O(log N) (소규모에선 선형이 더 빠를 수 있어 하이브리드 적용)
- 패턴: 인덱스 히트 시 후보 수 k에 대해 O(k)
- 접두사 압축 체인: O(체인 길이)

## 삽입 알고리즘(insert) 세부

- 와일드카드 \* 는 마지막 세그먼트만 허용
- 정적 세그먼트는 아레나 노드 생성 후 interner ID 정렬 불변 유지
- 패턴은 shape/weak-shape 인덱스로 탐색 범위를 축소하고, 점수 기반으로 안정 삽입
- 충돌 정책(요지)
  - 파라미터 이름 상이: 허용(정책에 따라 다르게 구성 가능)
  - 동일 위치 정규식 제약 상이: 충돌로 간주(안전성 보장)

## 정규식 가드/캐시

- validate_regex_safe: 백레퍼런스, 중첩 수량자 등 위험 패턴 차단
- anchor_and_compile: ^...$ 로 고정. 캐시가 상한 초과 시 상위 일부만 스캔하여 가장 오래된 항목 제거

## SoA(Struct of Arrays)

- patterns / pattern_nodes 분리로 캐시 지역성 개선
- pattern_children_idx를 통해 반복 순회시 인덱스 접근 최소화

## 메트릭(경량)

- 노드 카운터(원자적, Relaxed)
  - pfl_hits: first_literal 인덱스 히트 수
  - shape_hits / shape_misses: 삽입 시 shape 인덱스 적중/실패 수
- 집계 API: RouterHandle::metrics() → 트리 DFS 합산

## 옵션(RouterOptions)

- ignore_trailing_slash, ignore_duplicate_slashes, case_sensitive, allow_unsafe_regex

## 공개 API 요약

- Router / RouterBuilder / RouterHandle
  - add(method, path, key)
  - seal(&mut Router)
  - find(method, path)
  - metrics()

## 안전성 경계

- 빌드 단계 반복 DFS에서만 지역적인 unsafe 포인터 사용(외부 노출 없음)
- 아레나 수명 = 라우터 수명. NodeBox는 얕은 핸들 복제만 허용(해제 없음)
- 정규식은 안전 가드를 통해 방어

## 성능 팁

- 정적 키가 많을수록 interner ID 정렬 불변의 이점이 커짐(이진 탐색)
- 패턴 분포에 맞춰 first_literal/shape 인덱스 히트율 기반으로 SmallVec 상한, 후보 확장 정책, 선형/이진 임계값 튜닝 가능
- 접두사 압축은 공통 접두사가 많은 경로에서 큰 이득

## 테스트 커버리지 요약

- 정적/대소문자, 정규화(중복/후행), 파라미터/정규식, 와일드카드, 충돌/에러 코드, 접두사 압축, 대형 테이블, 동시 접근 시뮬레이션, SoA/인터너 경로 보강 케이스

## 사용 알고리즘 일람

- 라딕스 기반 트리(Radix-like) + 접두사 압축: 공통 접두사 체인을 `fused_edge`로 병합하여 깊이/분기를 축소
- 반복 DFS(Iterative DFS): 인덱스 재빌드/무효화 시 스택 기반 순회로 재귀 오버헤드/스택오버플로우 제거
- 정적 키 탐색 하이브리드: 소수(≤8)는 선형 스캔, 그 외는 이진 탐색(binary search)
- 인턴 ID 기반 정렬 불변: `static_keys`를 인턴 ID로 정렬하여 비교를 정수 비교로 단순화
- 문자열 인턴(Interner): 정적 키 문자열→u32 매핑으로 비교/해시 비용 절감
- 패턴 SoA(Struct of Arrays): `patterns`/`pattern_nodes` 분리로 캐시 지역성 향상
- 첫 리터럴 인덱스(First-literal Index): 세그먼트 첫 리터럴→패턴 인덱스 매핑으로 후보 집합 축소
- 패턴 Shape/Weak-Shape 인덱스: 형태 해시로 삽입 시 호환성 검사 범위 축소
- 패턴 점수화(Scoring) 및 안정 삽입: 구체성 기준 정렬 유지
- ASCII 대소문자 무시 비교(ASCII-ci): 8바이트 청크 비교 루프으로 무할당 소문자 비교
- 와일드카드 매칭: 남은 경로를 한 번에 캡처하는 테일 처리
- 정규식 안전 가드: 백레퍼런스/중첩 수량자 등 금지 패턴 필터링
- 정규식 캐시: 상한 초과 시 상위 일부만 스캔해 최오래 항목(evict-one) 제거하는 LRU 유사 정책
- SmallVec 최적화: 소용량 컨테이너에서 힙 할당 회피
- zero-copy 파라미터 캡처: (name,(offset,len))로 원본 문자열 슬라이스 지시
- 아레나 할당(Bump Allocation): 노드 생애 동안 단일 할당자로 빠른 생성/해제 비용 제거
- 증분 인덱스 빌드(Dirty Flag): 변경 서브트리만 미러/ID/뷰 인덱스 재구성
- shrink_to_fit 단계 수축: 봉인 후 메모리 과할당 축소

## 복잡도 및 공간 요약

- 정적 탐색: 평균 O(log N) (소수 분기에서는 O(N) 선형이 더 빠를 수 있어 하이브리드 적용)
- 패턴 탐색: 인덱스 히트 시 O(k) (k=후보 수), 미스 시 최악 O(P) (P=패턴 수)
- 인덱스 재빌드: dirty 서브트리 크기를 D라 할 때 O(D)
- 공간: 노드 및 자식 컨테이너는 SmallVec 우선, 대수준에서 O(total children + total patterns)
