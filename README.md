# Bunner Router

A Bun-first HTTP router that builds immutable snapshots up front and executes matches against a compact, cache-friendly layout. The repository is split into `packages/*` workspaces so you can embed the router or exercise it through the example app.

## Highlights

- **Immutable build artifacts** – `RouterBuilder` produces a read-only `RouterInstance` whose static layout can be serialized and shipped between processes.
- **Deterministic build pipeline** – compression, regex validation, wildcard metadata, and route flag calculation all occur inside `build()` so runtime work is minimal.
- **Pluggable cache/observability** – versioned match cache with LRU semantics plus hook bundles for cache hits, param branches, and stage timings.
- **Security-focused decoding** – configurable `%2F` handling, traversal guards, regex safety heuristics, and timeout-aware pattern testers.

## Workspace overview

| Folder                 | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `packages/core`        | Core runtime + injector primitives shared by HTTP server |
| `packages/http-server` | Router, HTTP worker, decorators, and benchmark suite     |
| `examples/`            | Bun app that wires the HTTP server package end-to-end    |

## Snapshot workflow

1. Define your routes and router options inside a manifest (see `packages/http-server/snapshot.manifest.json`).
2. Run the bundled CLI to build and serialize the router snapshot:

   ```bash
   bun packages/http-server/bin/generate-snapshot.ts --manifest packages/http-server/snapshot.manifest.json
   ```

   or, from within `packages/http-server`, simply run:

   ```bash
   bun run snapshot
   ```

3. The CLI writes a JSON payload containing layout arrays, metadata, and param-order snapshots that can be checked into artifacts or pushed to object storage. At runtime, inject the snapshot through `RadixRouterBuilder` or load it when instantiating workers.

## Development scripts

```bash
# Install dependencies
bun install

# Run unit + integration tests
bun test packages/http-server/tests

# Execute the HTTP router benchmarks
cd packages/http-server && bun run bench:router
```

## Example app

`examples/` ships with a Bun application showing how to bootstrap the router package, register modules, and serve HTTP traffic. Install dependencies inside that folder and start the dev server:

```bash
cd examples
bun install
bun run dev
```

## Contributing

- Keep router mutations inside the builder only; `RouterInstance` must stay immutable.
- Favor test coverage under `packages/http-server/tests` before changing core matchers.
- Update `PLAN.md`/`REPORT.md` whenever architectural work completes so downstream consumers have an audit trail.

## 라우터 기능 & 옵션

| 기능                 | 설명                                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 불변 빌더 파이프라인 | `RouterBuilder`가 모든 변경을 수집한 뒤 정적 압축·파라미터 재정렬·와일드카드 suffix 계산·정규식 안전성·스냅샷 메타데이터 단계가 포함된 결정적 `build()` 파이프라인을 실행해 읽기 전용 `RouterInstance`를 생성합니다. |
| 스냅샷 직렬화        | `ImmutableRouterLayout`과 메타데이터를 `packages/http-server/bin/generate-snapshot.ts` CLI로 내보내거나 불러와 콜드 스타트와 멀티 워커 배포를 단순화할 수 있습니다.                                                  |
| 정적 패스트 경로     | 대소문자 정규화 해시 테이블과 `LengthBitset`을 활용해 후행 슬래시 정리, 소문자 미러링을 포함한 O(1) 정적 라우트 조회를 제공합니다.                                                                                   |
| 동적 매처            | Radix 워커가 `:param`, `:name+`, `:name*`, 선택적 세그먼트, 와일드카드 suffix, 옵셔널 파라미터 기본값을 모두 지원합니다.                                                                                             |
| 캐시 & LRU           | `cacheSize` 기반 버전형 매치 캐시와 null-hit 추적, `touchCacheEntry` 훅을 통한 LRU 퇴출을 선택적으로 활성화할 수 있습니다.                                                                                           |
| 관측 훅              | `RouterObserverHooks`로 캐시 히트/미스, 파라미터 브랜치, 스테이지 타이밍, 매치 이벤트를 노출해 메트릭·트레이싱 백엔드와 연계할 수 있습니다.                                                                          |
| 정규식 안전 가드     | `regexSafety`와 `regexAnchorPolicy`로 길이 제한, 백트래킹/역참조 금지, 앵커 제거, 사용자 검증 훅, 실행 타임아웃을 제어합니다.                                                                                        |
| 경로 순회 방어       | `blockTraversal`, `collapseSlashes`, `ignoreTrailingSlash`, `encodedSlashBehavior` 조합으로 dot-segment 및 `%2F` 주입 공격을 차단합니다.                                                                             |
| 파라미터 순서 튜닝   | `paramOrderTuning`이 히트 카운트 임계값과 재시드 확률을 조합하고, `exportParamOrderingSnapshot()`으로 학습된 순서를 재부팅 후 복원합니다.                                                                            |
| 옵셔널 파라미터 모드 | `optionalParamBehavior`로 누락된 옵션 파라미터를 생략/`undefined`/빈 문자열 중 하나로 강제할 수 있습니다.                                                                                                            |
| 파이프라인 토글      | `pipelineStages`로 빌드·매치 스테이지별 on/off를 제어해 보안 강화형·성능 최적화형 프로파일을 구분할 수 있습니다.                                                                                                     |
| 엄격한 파라미터 이름 | `strictParamNames`가 빌드 시점에 전역적으로 유일한 파라미터 이름을 강제합니다.                                                                                                                                       |
| 인코딩된 슬래시 처리 | `encodedSlashBehavior`로 `%2F`/`%5C` 시퀀스를 디코드/보존/거부 중 하나로 라우터별 설정할 수 있습니다.                                                                                                                |

````bash
```markdown
# Bunner Router

A Bun-first HTTP router that builds immutable snapshots up front and executes matches against a compact, cache-friendly layout. The repository is split into `packages/*` workspaces so you can embed the router or exercise it through the example app.

## Highlights

- **Immutable build artifacts** – `RouterBuilder` produces a read-only `RouterInstance` whose static layout can be serialized and shipped between processes.
- **Deterministic build pipeline** – compression, regex validation, wildcard metadata, and route flag calculation all occur inside `build()` so runtime work is minimal.
- **Pluggable cache/observability** – versioned match cache with LRU semantics plus hook bundles for cache hits, param branches, and stage timings.
- **Security-focused decoding** – configurable `%2F` handling, traversal guards, regex safety heuristics, and timeout-aware pattern testers.

## Workspace overview

| Folder | Purpose |
|--------|---------|
| `packages/core` | Core runtime + injector primitives shared by HTTP server |
| `packages/http-server` | Router, HTTP worker, decorators, and benchmark suite |
| `examples/` | Small Bun app that wires the HTTP server package end-to-end |

## Snapshot workflow

1. Define your routes and router options inside a manifest (see `packages/http-server/snapshot.manifest.json`).
2. Run the bundled CLI to build and serialize the router snapshot:

	```bash
	bun packages/http-server/bin/generate-snapshot.ts --manifest packages/http-server/snapshot.manifest.json
	```

	or, from within `packages/http-server`, simply run:

	```bash
	bun run snapshot
	```

3. The CLI writes a JSON payload containing layout arrays, metadata, and param-order snapshots that can be checked into artifacts or pushed to object storage. At runtime, inject the snapshot through `RadixRouterBuilder` or load it when instantiating workers.

## Development scripts

```bash
# Install dependencies
bun install

# Run unit + integration tests
bun test packages/http-server/tests

# Execute the HTTP router benchmarks
cd packages/http-server && bun run bench:router
````

## Example app

`examples/` ships with a Bun application showing how to bootstrap the router package, register modules, and serve HTTP traffic. Install dependencies inside that folder and start the dev server:

```bash
cd examples
bun install
bun run dev
```

## Contributing

- Keep router mutations inside the builder only; `RouterInstance` must stay immutable.
- Favor test coverage under `packages/http-server/tests` before changing core matchers.
- Update `PLAN.md`/`REPORT.md` whenever architectural work completes so downstream consumers have an audit trail.
