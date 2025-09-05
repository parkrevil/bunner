#!/usr/bin/env bash
set -euo pipefail

echo "Running cargo udeps (workspace, all targets/features) with toolchain: nightly" >&2
cargo +nightly udeps --workspace --all-targets --all-features || true

echo "Running knip (TypeScript unused dependencies)..." >&2
bunx knip --dependencies

echo "Done. Review the above results for unused dependencies." >&2
