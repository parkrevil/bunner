# Bunner Router – Practical Optimization Plan

## Scope Fit
- Support only: static segments, params `:id`, tail wildcard `*`.
- Keep current modules: find/node/builder; avoid new pattern classes.

## Build Profiles (feature-gated)
- Features: `router-light` (default), `router-medium`, `router-high`.
- Light: `MAX_ROUTES=256`, conservative SmallVec capacities, static full map off by default.
- Medium: `MAX_ROUTES=65_536`, current capacities, static full map on by default.
- High: raise limit (potentially `RouteKey = u32`), larger index bounds, static full map on.
- Implementation: gate constants and defaults with `cfg(feature)`. Introduce `type RouteKey` alias; keep public API unchanged.

## ~~Bulk Insert (extreme performance, ordered keys)~~
- ~~API: `bulk_insert_ordered(entries: IntoIterator<(HttpMethod, String)>) -> Result<Vec<RouteKey>, RouterError>`.~~
- ~~Phase A (parallel preprocess):~~
  - ~~Normalize + parse on worker threads~~
  - ~~Pre-intern literals in thread-local buffers; dedup before merging to main interner~~
  - ~~Early pre-intern of first-literal before commit (single-thread)~~
  - ~~Emit `ParsedEntry { idx, method, segments, head_byte, path_len }`~~
  - ~~Stable bucket sort: head_byte → path_len → static-first to improve locality~~
- ~~Phase B (ultra-light single commit):~~
  - ~~Pre-assign keys: `base = next_route_key.fetch_add(N)`; `key[i] = base + i`~~
  - ~~Commit loop only descends/creates nodes; sets `dirty` flags; defers masks/indices/build to finalize~~
    - ~~Defer method_mask to finalize()~~
  - ~~No per-insert index/mask rebuilds, no per-insert map shuffles~~
 - ~~Post: call existing `finalize()` once to compress/build indices/masks/pruning/static map~~
- <b>~~(Abandoned) Optional later: lock striping by first segment for partial parallel commit; adopt only if clearly beneficial~~<b>

### ~~Finalization Policy~~
- ~~Call `finalize()` seals the router (SEALED) and forbids further `add`/`add_bulk`.~~

## Memory and Structure (low-risk first)
- ~~Pattern meta packed (done) – keep.~~
- ~~Node flags bitfield (SEALED, DIRTY – done) – optional extend later only if needed.~~
- Adjust SmallVec defaults by feature profile (light uses smaller, high can increase upper bounds).
- Optional runtime cleanup: after `finalize()`, clear compile-only containers under a feature flag (`router-runtime-cleanup`).
- Interner IDs: keep `u32` for now (lowest risk); consider `u16` only when bounded vocab confirmed (high profile).

## Monitoring and Safety
- Add lightweight `MemoryStats` behind `router-metrics`: node_count, pattern_count, estimated_memory, route_count.
- Enforce `MAX_ROUTES` consistently per feature; keep `MaxRoutesExceeded` error.

## SIMD/CPU Paths
- ~~Keep AVX2 path (already present).~~ 
- Add NEON as future optional feature stub; not required initially.

## Non-Goals (defer)
- ART conversion, compressed pointers, generational GC. Too invasive relative to current goals.

## Acceptance Criteria
- All profiles compile and pass existing 51/51 tests.
- Bulk insert returns keys in input order; equals single-insert results.
- Light/Medium/High switch changes limits and defaults only (no API break).

## Rollout Steps
1) Feature gates for limits/capacities/defaults + `RouteKey` alias.
2) ~~Implement `bulk_insert_ordered` (parallel parse + single commit).~~
3) Optional `router-runtime-cleanup` and `router-metrics` features.
4) (벤치마크는 TS FFI 경유로만 진행하므로 여기서는 제외)

## Timeline (target)
- Week 1: Step 1 + tests per profile.
- Week 2: Step 2 + tests for order and limits.
- Week 3: Step 3; decide on lock striping based on data.


