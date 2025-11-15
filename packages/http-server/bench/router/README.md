# HTTP Router benchmarks

This directory contains the Bun-based benchmark and profiling harness for the HTTP router. The default runner will
produce both JSON metrics and a CPU profile under `packages/http-server/bench/router/results`.

## Running the suite

```sh
bun packages/http-server/bench/router/runner.ts
```

The runner launches the full `router.bench.ts` matrix twice: once for JSON output (used for diffing previous runs) and
again with Bun's CPU profiler enabled. Artifacts are timestamped, and diffs against the previous result set are printed
automatically.

## Environment variables

| Variable              | Default | Description                                                                                                                                                                         |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ROUTER_LIST_WARM`    | `5`     | Sets how many times the `list()` heavy benchmarks rerun in a tight loop to model a hot cache. Increasing this makes the "xN (hot)" benchmarks spend more time in the warmed state.  |
| `ROUTER_PARAM_WARM`   | `8`     | Controls how many back-to-back param-heavy matches run inside the hot param cases. Raising the value exaggerates high-volume param workloads and stresses the decoder cache harder. |
| `ROUTER_BENCH_FILTER` | _unset_ | Optional regex that filters benchmarks by "group › name" before execution. Useful when focusing on a specific area.                                                                 |
| `ROUTER_BENCH_FORMAT` | _unset_ | When set to `json`, forces Mitata to emit machine-readable JSON. The runner sets this automatically for the metrics pass.                                                           |
| `ROUTER_BENCH_UNITS`  | `1`     | Set to `0` to hide measurement units in Mitata's console output.                                                                                                                    |
| `NO_COLOR`            | `0`     | Set to `1` to disable ANSI colors in Mitata output.                                                                                                                                 |

Each environment variable can be provided inline when running the script, for example:

```sh
ROUTER_LIST_WARM=10 ROUTER_PARAM_WARM=16 bun packages/http-server/bench/router/runner.ts
```
