#!/usr/bin/env bash
set -euo pipefail

CRATE_DIR="packages-ffi/http-server"
cd "$(dirname "$0")/.."

export RUSTFLAGS="-C target-cpu=native"
echo "Building benches..." >&2
cargo bench --no-run -p bunner-http-server

echo "Running router benches..." >&2
# Show full Criterion progress and summary output
cargo bench -p bunner-http-server || true
bun tools/generate-benchmark-md_http-server_router.ts
